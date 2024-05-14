import {
  FfmpegSettings,
  HdhrSettings,
  PlexStreamSettings,
  XmlTvSettings,
  defaultFfmpegSettings,
  defaultHdhrSettings,
  defaultPlexStreamSettings,
  defaultXmlTvSettings as defaultXmlTvSettingsSchema,
} from '@tunarr/types';
import { isUndefined, merge, once } from 'lodash-es';
import { Low, LowSync } from 'lowdb';
import path from 'path';
import fs from 'node:fs/promises';
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

const LoggingSettingsSchema = z.object({
  logLevel: z
    .union([
      z.literal('silent'),
      z.literal('fatal'),
      z.literal('error'),
      z.literal('warn'),
      z.literal('info'),
      z.literal('http'),
      z.literal('debug'),
      z.literal('trace'),
    ])
    .default(() => (isProduction ? 'info' : 'debug')),
  logsDirectory: z.string(),
});

const SystemSettingsSchema = z.object({
  logging: LoggingSettingsSchema,
});

type SystemSettings = z.infer<typeof SystemSettingsSchema>;

export const SettingsSchema = z.object({
  clientId: z.string(),
  hdhr: HdhrSettingsSchema,
  xmltv: XmlTvSettingsSchema,
  plexStream: PlexStreamSettingsSchema,
  ffmpeg: FfmpegSettingsSchema,
});

export type Settings = z.infer<typeof SettingsSchema>;

export const MigrationStateSchema = z.object({
  legacyMigration: z.boolean(),
});

export const SettingsFileSchema = z.object({
  version: z.number(),
  migration: MigrationStateSchema,
  settings: SettingsSchema,
  system: SystemSettingsSchema,
});

export type SettingsFile = z.infer<typeof SettingsFileSchema>;

export const defaultSchema = (dbBasePath: string): SettingsFile => ({
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
  private watcherController = new AbortController();

  constructor(dbPath: string, db: Low<SettingsFile>) {
    super();
    this.db = db;
    this.handleFileChanges(dbPath).catch(console.error);
    setImmediate(() => {
      this.logger = LoggerFactory.child(import.meta);
    });
  }

  needsLegacyMigration() {
    return !this.db.data.migration.legacyMigration;
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

  private async handleFileChanges(path: string) {
    const watcher = fs.watch(path, { signal: this.watcherController.signal });
    for await (const event of watcher) {
      if (event.eventType === 'change') {
        this.logger.debug('detected settings DB change on disk, reloading.');
        await this.db.read();
        this.emit('change');
      }
    }
  }
}

let settingsDbInstance: SettingsDB | undefined;

export const getSettings = once((dbPath?: string) => {
  if (!isUndefined(settingsDbInstance)) {
    return settingsDbInstance;
  }

  const actualPath =
    dbPath ?? path.resolve(globalOptions().databaseDirectory, 'settings.json');

  const needsFlush = !existsSync(actualPath);

  const defaultValue = defaultSchema(globalOptions().databaseDirectory);
  // Load this synchronously, but then give the DB instance an async version
  const db = new LowSync<SettingsFile>(
    new SyncSchemaBackedDbAdapter(SettingsFileSchema, actualPath, defaultValue),
    defaultValue,
  );

  db.read();
  if (needsFlush) {
    db.write();
  }

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
