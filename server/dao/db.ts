import { find, findIndex, isUndefined, once, sortBy } from 'lodash-es';
import { Low } from 'lowdb';
import { JSONPreset } from 'lowdb/node';
import path from 'path';
import { DeepReadonly } from 'ts-essentials';
import { v4 as uuidv4 } from 'uuid';
import constants from '../constants.js';
import { globalOptions } from '../globals.js';
import { Maybe } from '../types.js';
import { migrateFromLegacyDb } from './legacyDbMigration.js';
import z from 'zod';
import { FfmpegSettings } from 'dizquetv-types';
import { FfmpegSettingsSchema } from 'dizquetv-types/schemas';

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

// Temporary until we figure out how to properly represent the Program
// type in an extensible and accurate way
export const offlineProgram = (duration: number): DeepReadonly<Program> => {
  return {
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
  fillerRepeatCooldown?: number;
};

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

export type PlexServerSettings = {
  id?: string;
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

export const defaultXmlTvSettings: XmlTvSettings = {
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
  channels: Channel[];
  settings: Settings;
  customShows: CustomShow[];
  fillerLists: FillerList[];
  cachedImages: CachedImage[];
};

export const defaultSchema: Schema = {
  version: 1,
  migration: {
    legacyMigration: false,
  },
  channels: [],
  customShows: [],
  fillerLists: [],
  settings: {
    clientId: uuidv4(),
    hdhr: defaultHdhrSettings,
    xmltv: defaultXmlTvSettings,
    plexStream: defaultPlexStreamSettings,
    plexServers: [],
    ffmpeg: FfmpegSettingsSchema.parse(undefined), // Defaults
  },
  cachedImages: [],
};

abstract class IdBasedCollection<T, IdType extends string | number = string> {
  private name: string;
  protected db: Low<Schema>;

  constructor(name: string, db: Low<Schema>) {
    this.name = name;
    this.db = db;
  }

  getAll(): DeepReadonly<T[]> {
    return [...this.getAllMutable().map((x) => x as DeepReadonly<T>)];
  }

  protected abstract getAllMutable(): T[];

  protected abstract getId(item: T | DeepReadonly<T>): IdType;

  getById(id: IdType): Maybe<DeepReadonly<T>> {
    return find(this.getAll(), (x) => this.getId(x) === id);
  }

  async insertOrUpdate(item: T) {
    const all = this.getAllMutable();
    const idx = findIndex(all, (x) => this.getId(x) === this.getId(item));
    if (isUndefined(idx) || idx < 0 || idx >= all.length) {
      all.push(item);
    } else {
      all[idx] = item;
    }
    return this.db.write();
  }

  async delete(id: IdType) {
    const all = this.getAllMutable();
    const idx = findIndex(all, (x) => this.getId(x) === id);

    if (idx === -1) {
      console.warn(
        `${this.name} Collection with ID = ${id} missing when attempting delete`,
      );
      return void 0;
    }

    all.splice(idx, 1);

    return this.db.write();
  }
}

export class FillerListCollection extends IdBasedCollection<FillerList> {
  constructor(db: Low<Schema>) {
    super('FillerList', db);
  }

  protected getAllMutable(): FillerList[] {
    return this.db.data.fillerLists;
  }

  protected getId(item: FillerList | DeepReadonly<FillerList>): string {
    return item.id;
  }
}

export class CustomShowCollection extends IdBasedCollection<CustomShow> {
  constructor(db: Low<Schema>) {
    super('CustomShow', db);
  }

  protected getAllMutable(): CustomShow[] {
    return this.db.data.customShows;
  }

  protected getId(item: CustomShow | DeepReadonly<CustomShow>): string {
    return item.id;
  }
}

export class ChannelCollection extends IdBasedCollection<Channel, number> {
  constructor(db: Low<Schema>) {
    super('Channel', db);
  }

  protected getAllMutable(): Channel[] {
    return this.db.data.channels;
  }

  protected getId(item: Channel | DeepReadonly<Channel>): number {
    return item.number;
  }
}

export class PlexServerSettingsCollection extends IdBasedCollection<PlexServerSettings> {
  constructor(db: Low<Schema>) {
    super('PlexServer', db);
  }

  protected getAllMutable(): PlexServerSettings[] {
    return sortBy(this.db.data.settings.plexServers, 'index');
  }

  protected getId(
    item: PlexServerSettings | DeepReadonly<PlexServerSettings>,
  ): string {
    return item.name; // Is this right?
  }
}

export class CachedImageCollection extends IdBasedCollection<CachedImage> {
  constructor(db: Low<Schema>) {
    super('CachedImages', db);
  }

  protected getAllMutable(): CachedImage[] {
    if (isUndefined(this.db.data.cachedImages)) {
      this.db.data.cachedImages = [];
    }
    return this.db.data.cachedImages;
  }

  protected getId(item: CachedImage | DeepReadonly<CachedImage>): string {
    return item.hash;
  }
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

  clientId(): string {
    return this.db.data.settings.clientId;
  }

  plexServers(): PlexServerSettingsCollection {
    return new PlexServerSettingsCollection(this.db);
  }

  xmlTvSettings(): DeepReadonly<XmlTvSettings> {
    return this.db.data.settings.xmltv;
  }

  channels(): ChannelCollection {
    return new ChannelCollection(this.db);
  }

  fillerLists(): FillerListCollection {
    return new FillerListCollection(this.db);
  }

  customShows(): CustomShowCollection {
    return new CustomShowCollection(this.db);
  }

  cachedImages(): CachedImageCollection {
    return new CachedImageCollection(this.db);
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

  updateSettings<K extends keyof Settings>(key: K, settings: Settings[K]) {
    this.db.data.settings[key] = settings;
    return this.db.write();
  }
}

export const getDBRaw = () => {
  return JSONPreset<Schema>(
    path.resolve(globalOptions().database, 'db.json'),
    defaultSchema,
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
