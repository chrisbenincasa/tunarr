import { promises as fsPromises } from 'fs';
import {
  isArray,
  isNaN,
  isObject,
  isUndefined,
  map,
  mergeWith,
  once,
  parseInt,
  sortBy,
} from 'lodash-es';
import { Low } from 'lowdb';
import { JSONPreset } from 'lowdb/node';
import path from 'path';
import constants from '../constants.js';
import { globalOptions } from '../globals.js';
import createLogger from '../logger.js';

const CURRENT_VERSION = 1;

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

export type PlexServerSettings = {
  name: string;
  uri: string;
  accessToken: string;
  sendGuideUpdates: boolean;
  sendChannelUpdates: boolean;
  index: number;
};

type LegacyPlexSettings = {
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

export const defaultPlexStreamSettings: PlexStreamSettings = {
  streamPath: 'plex',
  enableDebugLogging: true,
  directStreamBitrate: 20000, // These were previously numnbers in dizque DB - migrate!
  transcodeBitrate: 2000,
  mediaBufferSize: 1000,
  transcodeMediaBufferSize: 20000,
  maxPlayableResolution: {
    widthPx: 1920,
    heightPx: 1080,
  },
  maxTranscodeResolution: {
    widthPx: 1920,
    heightPx: 1080,
  },
  videoCodecs: ['h264', 'hevc', 'mpeg2video', 'av1'],
  audioCodecs: ['ac3'],
  maxAudioChannels: 2,
  audioBoost: 100,
  enableSubtitles: false,
  subtitleSize: 100,
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
  plexStream: PlexStreamSettings;
  plexServers: PlexServerSettings[];
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
    plexStream: defaultPlexStreamSettings,
    plexServers: [],
  },
};

export class Database {}

async function readAllOldDbFile(file: string): Promise<object[] | object> {
  try {
    const data = await fsPromises.readFile(
      path.resolve(globalOptions().database, file + '.json'),
    );
    const str = data.toString('utf-8');
    const parsed = JSON.parse(str);
    return isArray(parsed) ? (parsed as object[]) : (parsed as object);
  } catch (e) {
    logger.error(e);
    throw e;
  }
}

async function readOldDbFile(file: string): Promise<object> {
  try {
    const data = await readAllOldDbFile(file);
    if (isArray(data)) {
      return data[0] as object;
    } else {
      return data as object;
    }
  } catch (e) {
    logger.error(e);
    throw e;
  }
}

function parseIntOrDefault(s: string, defaultValue: number): number {
  const parsed = parseInt(s);
  return isNaN(parsed) ? defaultValue : parsed;
}

function tryStringSplitOrDefault(
  s: string | undefined,
  delim: string,
  defaultValue: string[],
): string[] {
  return s?.split(delim) ?? defaultValue;
}

function tryParseResolution(s: string | undefined): Resolution | undefined {
  if (isUndefined(s)) {
    return undefined;
  }

  const parts = s.split('x', 2);
  if (parts.length < 2) {
    return undefined;
  }

  const x = parseInt(parts[0]);
  const y = parseInt(parts[1]);

  if (isNaN(x) || isNaN(y)) {
    return undefined;
  }

  return {
    widthPx: x,
    heightPx: y,
  };
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

  try {
    const plexSettings = (await readOldDbFile(
      'plex-settings',
    )) as LegacyPlexSettings;
    logger.debug('Migrating Plex settings', plexSettings);
    settings = {
      ...settings,
      plexStream: mergeWith<PlexStreamSettings, PlexStreamSettings>(
        {
          audioBoost: parseIntOrDefault(
            plexSettings['audioBoost'],
            defaultPlexStreamSettings.audioBoost,
          ),
          audioCodecs: tryStringSplitOrDefault(
            plexSettings['audioCodecs'],
            ',',
            defaultPlexStreamSettings.audioCodecs,
          ),
          directStreamBitrate: plexSettings['directStreamBitrate'],
          transcodeBitrate: plexSettings['transcodeBitrate'],
          mediaBufferSize: plexSettings['mediaBufferSize'],
          enableDebugLogging: plexSettings['debugLogging'],
          enableSubtitles: plexSettings['enableSubtitles'],
          forceDirectPlay: plexSettings['forceDirectPlay'],
          maxAudioChannels: parseIntOrDefault(
            plexSettings['maxAudioChannels'],
            defaultPlexStreamSettings.maxAudioChannels,
          ),
          maxPlayableResolution:
            tryParseResolution(plexSettings['maxPlayableResolution']) ??
            defaultPlexStreamSettings.maxPlayableResolution,
          maxTranscodeResolution:
            tryParseResolution(plexSettings['maxTranscodeResolution']) ??
            defaultPlexStreamSettings.maxTranscodeResolution,
          pathReplace: plexSettings['pathReplace'],
          pathReplaceWith: plexSettings['pathReplaceWith'],
          streamPath: plexSettings['streamPath'],
          streamProtocol: plexSettings['streamProtocol'],
          subtitleSize: parseIntOrDefault(
            plexSettings['subtitleSize'],
            defaultPlexStreamSettings.subtitleSize,
          ),
          transcodeMediaBufferSize: plexSettings.transcodeMediaBufferSize,
          updatePlayStatus: plexSettings.updatePlayStatus,
          videoCodecs: tryStringSplitOrDefault(
            plexSettings.videoCodecs,
            ',',
            defaultPlexStreamSettings.videoCodecs,
          ),
        },
        defaultPlexStreamSettings,
        (legacyObjValue, defaultObjValue) => {
          if (isUndefined(legacyObjValue)) {
            return defaultObjValue;
          }
        },
      ),
    };
  } catch (e) {
    logger.error('Unable to migrate Plex settings', e);
  }

  try {
    const plexServers = await readAllOldDbFile('plex-servers');
    logger.info('Migrating Plex servers', plexServers);
    let servers: object[] = [];
    if (isArray(plexServers)) {
      servers = [...plexServers];
    } else if (isObject(plexServers)) {
      servers = [plexServers];
    }
    const migratedServers: PlexServerSettings[] = sortBy(
      map(servers, (server) => {
        return {
          name: server['name'],
          uri: server['uri'],
          accessToken: server['accessToken'],
          sendChannelUpdates: server['arChannels'],
          sendGuideUpdates: server['arGuide'],
          index: server['index'],
        } as PlexServerSettings;
      }),
      'index',
    );
    settings = {
      ...settings,
      plexServers: migratedServers,
    };
  } catch (e) {
    logger.error('Unable to migrate Plex server settings', e);
  }

  db.data.settings = settings as Required<Settings>;
  db.data.migration.legacyMigration = true;
  return db.write();
}

export class DbAccess {
  private db: Low<Schema>;

  constructor(db: Low<Schema>) {
    this.db = db;
  }

  needsLegacyMigration() {
    return this.db.data.migration.legacyMigration;
  }

  async migrateFromLegacyDb() {
    return migrateFromLegacyDb(this.db);
  }

  plexServers() {
    return sortBy(this.db.data.settings.plexServers, 'index');
  }

  xmlTvSettings() {
    return this.db.data.settings.xmltv;
  }
}

export const getDBRaw = () => {
  return JSONPreset<Schema>(
    path.resolve(globalOptions().database, 'db.json'),
    defaultData,
  );
};

export const getDB = once(async () => {
  const db = await getDBRaw();

  const access = new DbAccess(db);

  if (!access.needsLegacyMigration()) {
    await access.migrateFromLegacyDb();
  }

  if (db.data.version < CURRENT_VERSION) {
    // We need to perform a migration
  }

  return access;
});
