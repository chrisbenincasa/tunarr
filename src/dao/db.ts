import { filter, findIndex, once, sortBy } from 'lodash-es';
import { v4 as uuidv4 } from 'uuid';
import { Low } from 'lowdb';
import { JSONPreset } from 'lowdb/node';
import path from 'path';
import constants from '../constants.js';
import { globalOptions } from '../globals.js';
import { migrateFromLegacyDb } from './legacy-db-migration.js';

const CURRENT_VERSION = 1;

export type ProgramType =
  | 'movie'
  | 'episode'
  | 'track'
  | 'redirect'
  | 'custom'
  | 'flex';

export type Program = {
  title: string;
  key: string;
  ratingKey: string;
  icon: string;
  type: ProgramType;
  duration: number;
  summary: string;
  plexFile: string;
  file: string;
  showTitle?: string; // Unclear if this is necessary
  episode?: number;
  season?: number;
  episodeIcon?: string;
  seasonIcon?: string;
  showIcon?: string;
  serverKey: string;
  rating?: string;
  date?: string;
  year?: number;
  channel?: number; // Redirect
  isOffline: boolean; // Flex
  customShowId?: string;
  customShowName?: string;
  customOrder?: number;
};

export type Watermark = {
  enabled: boolean;
  position: string;
  width: number;
  verticalMargin: number;
  horizontalMargin: number;
  duration: number;
};

export type FillerCollection = {
  id: string;
  weight: number;
  cooldownSeconds: number;
};

export type ChannelTranscodingOptions = {
  targetResolution: Resolution;
};

export type ChannelOffline = {
  picture?: string;
  soundtrack?: string;
  mode: string;
};

export type ChannelIcon = {
  path: string;
  width: number;
  duration: number;
  position: string;
};

export type Channel = {
  number: number;
  watermark?: Watermark;
  fillerCollections?: FillerCollection[];
  programs: Program[];
  icon: ChannelIcon;
  guideMinimumDurationSeconds: number;
  groupTitle: string;
  disableFillerOverlay: boolean;
  // iconWidth: number;
  // iconDuration: number;
  // iconPosition: string;
  // startTime: Date;
  startTimeEpoch: number;
  offline: ChannelOffline;
  // offlinePicture: string;
  // offlineSoundtrack: string;
  // offlineMode: string;
  name: string;
  transcoding?: ChannelTranscodingOptions;
  duration: number;
  fallback: Program[];
  stealth: boolean;
  guideFlexPlaceholder?: string;
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
  clientId: string;
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
    clientId: uuidv4(),
    hdhr: defaultHdhrSettings,
    xmltv: defaultXmlTvSettings,
    plexStream: defaultPlexStreamSettings,
    plexServers: [],
  },
};

export class Database {}

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

  channels() {
    return this.db.data.channels;
  }

  upsertChannel(newChannel: Channel) {
    const idx = findIndex(this.db.data.channels, {
      number: newChannel.number,
    });

    if (idx === -1) {
      this.db.data.channels.push(newChannel);
    } else {
      this.db.data.channels[idx] = newChannel;
    }

    return this.db.write();
  }

  deleteChannel(channelNumber: number) {
    this.db.data.channels = filter(
      this.db.data.channels,
      (channel) => channel.number !== channelNumber,
    );
    return this.db.write();
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
  await db.read();

  const access = new DbAccess(db);

  if (!access.needsLegacyMigration()) {
    await access.migrateFromLegacyDb();
  }

  if (db.data.version < CURRENT_VERSION) {
    // We need to perform a migration
  }

  return access;
});
