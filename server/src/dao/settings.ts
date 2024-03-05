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
import { existsSync } from 'fs';
import { once } from 'lodash-es';
import { Low } from 'lowdb';
import { JSONFilePreset } from 'lowdb/node';
import path from 'path';
import { DeepReadonly } from 'ts-essentials';
import { v4 as uuidv4 } from 'uuid';
import { globalOptions } from '../globals.js';

const CURRENT_VERSION = 1;

export const defaultXmlTvSettings = (dbBasePath: string): XmlTvSettings => ({
  ...defaultXmlTvSettingsSchema,
  outputPath: path.resolve(dbBasePath, 'xmltv.xml'),
});

export type SettingsSchema = {
  clientId: string;
  hdhr: HdhrSettings;
  xmltv: XmlTvSettings;
  plexStream: PlexStreamSettings;
  ffmpeg: FfmpegSettings;
};

type MigrationState = {
  legacyMigration: boolean;
};

export type Schema = {
  version: number;
  migration: MigrationState;
  settings: SettingsSchema;
};

export const defaultSchema = (dbBasePath: string): Schema => ({
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
});

export class Settings {
  private db: Low<Schema>;

  constructor(db: Low<Schema>) {
    this.db = db;
  }

  needsLegacyMigration() {
    return this.db.data.migration.legacyMigration;
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

  updateFfmpegSettings(ffmpegSettings: FfmpegSettings) {
    return this.updateSettings('ffmpeg', { ...ffmpegSettings });
  }

  updateSettings<K extends keyof SettingsSchema>(
    key: K,
    settings: SettingsSchema[K],
  ) {
    this.db.data.settings[key] = settings;
    return this.db.write();
  }
}

export const getSettingsRawDb = once(async (dbPath?: string) => {
  const actualPath =
    dbPath ?? path.resolve(globalOptions().database, 'settings.json');

  const needsFlush = !existsSync(actualPath);

  const db = await JSONFilePreset<Schema>(
    actualPath,
    defaultSchema(globalOptions().database),
  );

  await db.read();
  if (needsFlush) {
    await db.write();
  }
  return db;
});

export const getSettings = once(async (dbPath?: string) => {
  const db = await getSettingsRawDb(dbPath);

  const access = new Settings(db);

  if (db.data.version < CURRENT_VERSION) {
    // We need to perform a migration
  }

  return access;
});
