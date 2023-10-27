import { promises as fsPromises } from 'fs';
import { isArray, once } from 'lodash-es';
import { Low } from 'lowdb';
import { JSONPreset } from 'lowdb/node';
import path from 'path';
import { globalOptions } from '../globals.js';
import createLogger from '../logger.js';
import constants from '../constants.js';

const logger = createLogger(import.meta);

export type Program = {};

export type Watermark = {};

export type FillerCollection = {};

export type ChannelTranscodingOptions = {};

export type Channel = {
  number: number;
  watermark?: Watermark;
  fillerCollections?: FillerCollection[];
  programs?: Program[];
  icon: string;
  guideMinimumDurationSeconds: number;
  groupTitle: string;
  disableFillerOverlay: boolean;
  iconWidth: number;
  iconDuration: number;
  iconPosition: string;
  startTime: Date; // change to millis
  offlinePicture: string;
  offlineSoundtrack: string;
  offlineMode: string;
  name: string;
  transcoding?: ChannelTranscodingOptions;
  duration: number;
};

export type FfmpegSettings = {
  configVersion: number;
  ffmpegPath: string;
  threads: number;
  concatMuxDelay: string;
  logFfmpeg: boolean;
  enableFFMPEGTranscoding: boolean;
  audioVolumePercent: number;
  videoEncoder: string;
  audioEncoder: string;
  targetResolution: string;
  videoBitrate: number;
  videoBufSize: number;
};

export type PlexSettings = {
  streamPath: string;
  debugLogging: boolean;
  directStreamBitrate: number;
  transcodeBitrate: number;
  mediaBufferSize: number;
  transcodeMediaBufferSize: number;
  maxPlayableResolution: string;
  maxTranscodeResolution: string;
  videoCodecs: string;
  audioCodecs: string;
  maxAudioChannels: string;
  audioBoost: string;
  enableSubtitles: boolean;
  subtitleSize: string;
  updatePlayStatus: boolean;
  streamProtocol: string;
  forceDirectPlay: boolean;
  pathReplace: string;
  pathReplaceWith: string;
};

export const defaultPlexSettings: PlexSettings = {
  streamPath: 'plex',
  debugLogging: true,
  directStreamBitrate: 20000, // These were previously numnbers in dizque DB - migrate!
  transcodeBitrate: 2000,
  mediaBufferSize: 1000,
  transcodeMediaBufferSize: 20000,
  maxPlayableResolution: '1920x1080',
  maxTranscodeResolution: '1920x1080',
  videoCodecs: 'h264,hevc,mpeg2video,av1',
  audioCodecs: 'ac3',
  maxAudioChannels: '2',
  audioBoost: '100',
  enableSubtitles: false,
  subtitleSize: '100',
  updatePlayStatus: false,
  streamProtocol: 'http',
  forceDirectPlay: false,
  pathReplace: '',
  pathReplaceWith: '',
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

const defaultXmlTvSettings: XmlTvSettings = {
  programmingHours: 12,
  refreshHours: 4,
  outputPath: path.resolve(constants.DEFAULT_DATA_DIR, 'xmltv.xml'),
  enableImageCache: false,
};

export type Settings = {
  hdhr: HdhrSettings;
  xmltv: XmlTvSettings;
};

type MigrationState = {
  legacyMigration: boolean;
};

export type Schema = {
  version: number;
  migration: MigrationState;
  channels: Channel[];
  settings: Settings;
};

const defaultData: Schema = {
  version: 1,
  migration: {
    legacyMigration: false,
  },
  channels: [],
  settings: {
    hdhr: defaultHdhrSettings,
    xmltv: defaultXmlTvSettings,
  },
};

export class Database {}

async function readOldDbFile(file: string): Promise<object> {
  try {
    const data = await fsPromises.readFile(
      path.resolve(globalOptions().database, file + '.json'),
    );
    const str = data.toString('utf-8');
    const parsed = JSON.parse(str);
    if (isArray(parsed)) {
      return parsed[0] as object;
    } else {
      return parsed as object;
    }
  } catch (e) {
    logger.error(e);
    throw e;
  }
}

export async function migrateFromLegacyDb(db: Low<Schema>) {
  let settings: Partial<Settings> = {};
  try {
    const hdhrSettings = await readOldDbFile('hdhr-settings');
    logger.debug('Migrating HDHR settings', hdhrSettings);
    settings = {
      ...settings,
      hdhr: {
        autoDiscoveryEnabled: hdhrSettings['autoDiscovery'] ?? true,
        tunerCount: hdhrSettings['tunerCount'] ?? 2,
      },
    };
  } catch (e) {
    logger.error('Unable to migrate HDHR settings', e);
  }

  try {
    const xmltvSettings = await readOldDbFile('xmltv-settings');
    logger.debug('Migrating XMLTV settings', xmltvSettings);
    settings = {
      ...settings,
      xmltv: {
        enableImageCache: xmltvSettings['enableImageCache'],
        outputPath: xmltvSettings['outputPath'],
        programmingHours: xmltvSettings['cache'],
        refreshHours: xmltvSettings['refresh'],
      },
    };
  } catch (e) {
    logger.error('Unable to migrate XMLTV settings', e);
  }

  db.data.settings = settings as Required<Settings>;
  db.data.migration.legacyMigration = true;
  return db.write();
}

export const getDBRaw = () => {
  return JSONPreset<Schema>(
    path.resolve(globalOptions().database, 'db.json'),
    defaultData,
  );
};

export const getDB = once(async () => {
  const db = await getDBRaw();

  if (!db.data.migration.legacyMigration) {
    await migrateFromLegacyDb(db);
  }

  return db;
});
