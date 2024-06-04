import {
  FfmpegSettings,
  HdhrSettings,
  LoggingSettingsSchema,
  PlexStreamSettings,
  SystemSettings,
  SystemSettingsSchema,
  XmlTvSettings,
  defaultFfmpegSettings,
  defaultHdhrSettings,
  defaultPlexStreamSettings,
  defaultXmlTvSettings as defaultXmlTvSettingsSchema,
} from '@tunarr/types';
import { isUndefined, merge, once } from 'lodash-es';
import { Low, LowSync } from 'lowdb';
import path from 'path';
import chokidar from 'chokidar';
import { DeepReadonly } from 'ts-essentials';
import { v4 as uuidv4 } from 'uuid';
import { globalOptions } from '../globals.js';
import { z } from 'zod';
import {
  FfmpegSettingsSchema,
  HdhrSettingsSchema,
  PlexStreamSettingsSchema,
  XmlTvSettingsSchema,
} from '@tunarr/types/schemas';
import { SchemaBackedDbAdapter } from './SchemaBackedDbAdapter.js';
import { SyncSchemaBackedDbAdapter } from './SyncSchemaBackedDbAdapter.js';
import { isProduction } from '../util/index.js';
import { Logger } from 'pino';
import {
  LoggerFactory,
  getDefaultLogDirectory,
  getDefaultLogLevel,
} from '../util/logging/LoggerFactory.js';
import events from 'events';
import { TypedEventEmitter } from '../types/eventEmitter.js';
import { existsSync } from 'node:fs';

const CURRENT_VERSION = 1;

export const defaultXmlTvSettings = (dbBasePath: string): XmlTvSettings => ({
  ...defaultXmlTvSettingsSchema,
  outputPath: path.resolve(dbBasePath, 'xmltv.xml'),
});

export const SettingsSchema = z.object({
  clientId: z.string(),
  hdhr: HdhrSettingsSchema,
  xmltv: XmlTvSettingsSchema,
  plexStream: PlexStreamSettingsSchema,
  ffmpeg: FfmpegSettingsSchema,
});

export type Settings = z.infer<typeof SettingsSchema>;

export const MigrationStateSchema = z.object({
  legacyMigration: z
    .boolean()
    .default(false)
    .describe('Whether a legacy migration was performed'),
  isFreshSettings: z.boolean().default(true).optional(),
});

export type MigrationState = z.infer<typeof MigrationStateSchema>;

export const SettingsFileSchema = z.object({
  version: z.number(),
  migration: MigrationStateSchema,
  settings: SettingsSchema,
  system: SystemSettingsSchema.extend({
    logging: LoggingSettingsSchema.extend({
      logLevel: SystemSettingsSchema.shape.logging.shape.logLevel.default(() =>
        isProduction ? 'info' : 'debug',
      ),
    }),
  }),
});

export type SettingsFile = z.infer<typeof SettingsFileSchema>;

export const defaultSettings = (dbBasePath: string): SettingsFile => ({
  version: 1,
  migration: {
    legacyMigration: false,
  },
  settings: {
    clientId: uuidv4(),
    hdhr: defaultHdhrSettings,
    xmltv: defaultXmlTvSettings(dbBasePath),
    plexStream: defaultPlexStreamSettings,
    ffmpeg: defaultFfmpegSettings,
  },
  system: {
    logging: {
      logLevel: getDefaultLogLevel(),
      logsDirectory: getDefaultLogDirectory(),
      useEnvVarLevel: true,
    },
  },
});

type SettingsChangeEvents = {
  change(): void;
};

abstract class ITypedEventEmitter extends (events.EventEmitter as new () => TypedEventEmitter<SettingsChangeEvents>) {}

export class SettingsDB extends ITypedEventEmitter {
  private logger: Logger;
  private db: Low<SettingsFile>;

  constructor(dbPath: string, db: Low<SettingsFile>) {
    super();
    this.db = db;
    this.handleFileChanges(dbPath);
    setImmediate(() => {
      this.logger = LoggerFactory.child(import.meta);
    });
  }

  needsLegacyMigration() {
    return !this.db.data.migration.legacyMigration;
  }

  get migrationState(): DeepReadonly<MigrationState> {
    return this.db.data.migration;
  }

  clientId(): string {
    return this.db.data.settings.clientId;
  }

  xmlTvSettings(): DeepReadonly<XmlTvSettings> {
    return this.db.data.settings.xmltv;
  }

  hdhrSettings(): DeepReadonly<HdhrSettings> {
    return this.db.data.settings.hdhr;
  }

  plexSettings(): DeepReadonly<PlexStreamSettings> {
    return this.db.data.settings.plexStream;
  }

  ffmpegSettings(): DeepReadonly<FfmpegSettings> {
    return this.db.data.settings.ffmpeg;
  }

  systemSettings(): DeepReadonly<SystemSettings> {
    return this.db.data.system;
  }

  updateFfmpegSettings(ffmpegSettings: FfmpegSettings) {
    return this.updateSettings('ffmpeg', { ...ffmpegSettings });
  }

  async directUpdate(fn: (settings: SettingsFile) => SettingsFile) {
    return await this.db.update(fn);
  }

  async updateSettings<K extends keyof Settings>(
    key: K,
    settings: Settings[K],
  ) {
    this.db.data.settings[key] = settings;
    return await this.db.write();
  }

  // Be careful!!!
  async updateBaseSettings<K extends keyof Omit<SettingsFile, 'settings'>>(
    key: K,
    settings: Partial<SettingsFile[K]>,
  ) {
    this.db.data[key] = merge(this.db.data[key], settings);
    return await this.db.write();
  }

  async flush() {
    return this.db.write();
  }

  private handleFileChanges(path: string) {
    const watcher = chokidar.watch(path, {
      persistent: false,
      awaitWriteFinish: true,
    });

    watcher.on('change', () => {
      this.logger.debug(
        'Detected change to settings DB file %s on disk. Reloading.',
        path,
      );
      this.db
        .read()
        .then(() => this.emit('change'))
        .catch(console.error);
    });
  }
}

let settingsDbInstance: SettingsDB | undefined;

export const getSettings = once((dbPath?: string) => {
  if (!isUndefined(settingsDbInstance)) {
    return settingsDbInstance;
  }

  const actualPath =
    dbPath ?? path.resolve(globalOptions().databaseDirectory, 'settings.json');

  const freshSettings = !existsSync(actualPath);

  const defaultValue = defaultSettings(globalOptions().databaseDirectory);
  // Load this synchronously, but then give the DB instance an async version
  const db = new LowSync<SettingsFile>(
    new SyncSchemaBackedDbAdapter(SettingsFileSchema, actualPath, defaultValue),
    defaultValue,
  );

  db.read();
  db.update((data) => {
    data.migration.isFreshSettings = freshSettings;
    // Redefine thie variable... it came before "isFreshSettings".
    // If this is a fresh run, mark legacyMigration as false
    if (freshSettings) {
      data.migration.legacyMigration = false;
    }
  });

  settingsDbInstance = new SettingsDB(
    actualPath,
    new Low<SettingsFile>(
      new SchemaBackedDbAdapter(SettingsFileSchema, actualPath, defaultValue),
      db.data,
    ),
  );

  if (db.data.version < CURRENT_VERSION) {
    // We need to perform a migration
  }

  return settingsDbInstance;
});
