import {
  Channel,
  FfmpegSettings,
  Program,
  defaultFfmpegSettings,
  defaultPlexStreamSettings,
} from 'dizquetv-types';
import { once } from 'lodash-es';
import { Low } from 'lowdb';
import { JSONFilePreset } from 'lowdb/node';
import path from 'path';
import { DeepReadonly } from 'ts-essentials';
import { v4 as uuidv4 } from 'uuid';
import z from 'zod';
import constants from '../constants.js';
import { globalOptions } from '../globals.js';
import { existsSync } from 'fs';

const CURRENT_VERSION = 1;

export type ProgramType =
  | 'movie'
  | 'episode'
  | 'track'
  | 'redirect'
  | 'custom'
  | 'flex';

// export type Program = {
//   title: string;
//   key: string;
//   ratingKey: string;
//   icon: string;
//   type: ProgramType;
//   duration: number;
//   summary: string;
//   plexFile: string;
//   file: string;
//   showTitle?: string; // Unclear if this is necessary
//   episode?: number;
//   season?: number;
//   episodeIcon?: string;
//   seasonIcon?: string;
//   showIcon?: string;
//   serverKey: string;
//   rating?: string;
//   date?: string;
//   year?: number;
//   channel?: number; // Redirect
//   isOffline: boolean; // Flex
//   customShowId?: string;
//   customShowName?: string;
//   customOrder?: number;
// };

// Temporary until we figure out how to properly represent the Program
// type in an extensible and accurate way
export const offlineProgram = (duration: number): DeepReadonly<Program> => {
  return {
    id: 'offline',
    isOffline: true,
    duration,
    // Bogus fields...
    title: 'Offline',
    key: '',
    ratingKey: '',
    icon: '',
    type: 'flex',
    summary: '',
    plexFile: '',
    file: '',
    serverKey: '',
  };
};

// Should this really be separate?
export type CustomProgram = Program;

export type CustomShow = {
  id: string;
  name: string;
  content: CustomProgram[];
};

export type FillerProgram = Program;

export type FillerList = {
  id: string;
  name: string;
  content: FillerProgram[];
};

export type Watermark = {
  url?: string;
  enabled: boolean;
  position: string;
  width: number;
  verticalMargin: number;
  horizontalMargin: number;
  duration: number;
  fixedSize: boolean;
  animated: boolean;
};

export const defaultWatermark: Watermark = {
  enabled: false,
  position: 'bottom-right',
  width: 10.0,
  verticalMargin: 0.0,
  horizontalMargin: 0.0,
  duration: 0,
  animated: false,
  fixedSize: true,
};

export type FillerCollection = {
  id: string;
  weight: number;
  cooldownSeconds: number;
};

export type ChannelTranscodingOptions = {
  targetResolution: Resolution;
  videoBitrate?: number;
  videoBufferSize?: number;
};

export type ChannelOffline = {
  picture?: string;
  soundtrack?: string;
  mode: string;
};

export const ChannelIconSchema = z.object({
  path: z.string(),
  width: z.number(),
  duration: z.number(),
  position: z.string(),
});

export type ChannelIcon = z.infer<typeof ChannelIconSchema>;

export type ImmutableChannel = DeepReadonly<Channel>;

export type Resolution = {
  widthPx: number;
  heightPx: number;
};

export type PlexStreamSettings = {
  streamPath: string;
  enableDebugLogging: boolean;
  directStreamBitrate: number;
  transcodeBitrate: number;
  mediaBufferSize: number;
  transcodeMediaBufferSize: number;
  maxPlayableResolution: Resolution;
  maxTranscodeResolution: Resolution;
  videoCodecs: string[];
  audioCodecs: string[];
  maxAudioChannels: number;
  audioBoost: number;
  enableSubtitles: boolean;
  subtitleSize: number;
  updatePlayStatus: boolean;
  streamProtocol: string;
  forceDirectPlay: boolean;
  pathReplace: string;
  pathReplaceWith: string;
};

export type HdhrSettings = {
  autoDiscoveryEnabled: boolean;
  tunerCount: number;
};

export const defaultHdhrSettings: HdhrSettings = {
  autoDiscoveryEnabled: true,
  tunerCount: 2,
};

export type XmlTvSettings = {
  programmingHours: number;
  refreshHours: number;
  outputPath: string;
  enableImageCache: boolean;
};

export const defaultXmlTvSettings: XmlTvSettings = {
  programmingHours: 12,
  refreshHours: 4,
  outputPath: path.resolve(constants.DEFAULT_DATA_DIR, 'xmltv.xml'),
  enableImageCache: false,
};

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

export type CachedImage = {
  hash: string;
  mimeType?: string;
  url: string;
};

export type Schema = {
  version: number;
  migration: MigrationState;
  settings: SettingsSchema;
};

export const defaultSchema: Schema = {
  version: 1,
  migration: {
    legacyMigration: false,
  },
  settings: {
    clientId: uuidv4(),
    hdhr: defaultHdhrSettings,
    xmltv: defaultXmlTvSettings,
    plexStream: defaultPlexStreamSettings,
    ffmpeg: defaultFfmpegSettings,
  },
};

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

  const db = await JSONFilePreset<Schema>(actualPath, defaultSchema);

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
