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
import {
  BackupSettings,
  FfmpegSettingsSchema,
  HdhrSettingsSchema,
  PlexStreamSettingsSchema,
  XmlTvSettingsSchema,
} from '@tunarr/types/schemas';
import events from 'events';
import { isUndefined, merge, once } from 'lodash-es';
import { Low, LowSync } from 'lowdb';
import { existsSync } from 'node:fs';
import path from 'path';
import { DeepReadonly } from 'ts-essentials';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { globalOptions } from '../globals.js';
import { TypedEventEmitter } from '../types/eventEmitter.js';
import { isProduction } from '../util/index.js';
import {
  Logger,
  LoggerFactory,
  getDefaultLogDirectory,
  getDefaultLogLevel,
} from '../util/logging/LoggerFactory.js';
import { SchemaBackedDbAdapter } from './SchemaBackedDbAdapter.js';
import { SyncSchemaBackedDbAdapter } from './SyncSchemaBackedDbAdapter.js';

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
    backup: {
      configurations: [],
    },
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

  constructor(db: Low<SettingsFile>) {
    super();
    this.db = db;
    setImmediate(() => {
      this.logger = LoggerFactory.child({
        caller: import.meta,
        className: SettingsDB.name,
      });
    });
  }

  needsLegacyMigration() {
    return !this.db.data.migration.legacyMigration;
  }

  get migrationState(): DeepReadonly<MigrationState> {
    return this.db.data.migration;
  }

  get backup(): DeepReadonly<BackupSettings> {
    return this.db.data.system.backup;
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

  async directUpdate(fn: (settings: SettingsFile) => SettingsFile | void) {
    return await this.db.update(fn).then(() => {
      this.logger?.debug(
        'Detected change to settings DB file on disk. Reloading.',
      );
      this.emit('change');
    });
  }

  async updateSettings<K extends keyof Settings>(
    key: K,
    settings: Settings[K],
  ) {
    return await this.directUpdate((oldSettings) => {
      oldSettings.settings[key] = settings;
    });
  }

  // Be careful!!!
  async updateBaseSettings<K extends keyof Omit<SettingsFile, 'settings'>>(
    key: K,
    settings: Partial<SettingsFile[K]>,
  ) {
    return await this.db.update((olDsettings) => {
      olDsettings[key] = merge(olDsettings[key], settings);
    });
  }

  async flush() {
    return this.db.write();
  }

  // private handleFileChanges(path: string) {
  //   const watcher = chokidar.watch(path, {
  //     persistent: false,
  //     awaitWriteFinish: true,
  //   });

  //   watcher.on('change', () => {
  // this.logger.debug(
  //   'Detected change to settings DB file %s on disk. Reloading.',
  //   path,
  // );
  //     this.db
  //       .read()
  //       .then(() => this.emit('change'))
  //       .catch(console.error);
  //   });
  // }
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
