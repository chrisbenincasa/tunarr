import {
  DbAccess,
  FfmpegSettings,
  ImmutableChannel,
  Watermark,
} from './dao/db.js';

export type GlobalOptions = {
  database: string;
  force_migration: boolean;
};

export type ServerOptions = GlobalOptions & {
  port: number;
};

export type Maybe<T> = T | undefined;

export type PlayerContext = {
  lineupItem: LineupItem;
  ffmpegSettings: FfmpegSettings;
  channel: ContextChannel;
  m3u8: boolean;
  audioOnly: boolean;
  isLoading?: boolean;
  watermark?: Watermark;
  dbAccess: DbAccess;
};

type BaseLineupItem = {
  err?: Error;
  originalT0?: number;
  streamDuration?: number;
  beginningOffset?: number;
  title?: string;
};

export type LineupItem =
  | OfflineLineupItem
  | ProgramLineupItem
  | CommercialLineupItem
  | LoadingLineupItem;

export function isOfflineLineupItem(
  item: LineupItem,
): item is OfflineLineupItem {
  return item.type === 'offline';
}

export function isCommercialLineupItem(
  item: LineupItem,
): item is CommercialLineupItem {
  return item.type === 'commercial';
}

export function isProgramLineupItem(
  item: LineupItem,
): item is ProgramLineupItem {
  return item.type === 'program';
}

export function isPlexBackedLineupItem(
  item: LineupItem,
): item is PlexBackedLineupItem {
  return isCommercialLineupItem(item) || isProgramLineupItem(item);
}

export type PlexBackedLineupItem = CommercialLineupItem | ProgramLineupItem;

type OfflineLineupItem = BaseLineupItem & {
  type: 'offline';
  duration: number;
  start: number;
};

type LoadingLineupItem = BaseLineupItem & {
  type: 'loading';
  streamDuration: number;
  duration: number;
  start: number;
};

type CommercialLineupItem = BaseLineupItem & {
  type: 'commercial';
  key: string;
  plexFile: string;
  file: string;
  ratingKey: string;
  start: number;
  streamDuration: number;
  beginningOffset: number;
  duration: number;
  serverKey: string;
  fillerId: string;
};

type ProgramLineupItem = BaseLineupItem & {
  type: 'program';
  key: string;
  plexFile: string;
  file: string;
  ratingKey: string;
  start: number;
  streamDuration: number;
  beginningOffset: number;
  duration: number;
  serverKey: string;
  title: string;
};

type TupleToUnion<T extends unknown[]> = T[number];

// Typescript is wild... define a static tuple and also
// derive a union type, so we can use the tuple for actually picking
// the keys to keep from Channel in a typesafe way!
export const CHANNEL_CONTEXT_KEYS: [
  'disableFillerOverlay',
  'watermark',
  'icon',
  'offlinePicture',
  'offlineSoundtrack',
  'name',
  'transcoding',
  'number',
] = [
  'disableFillerOverlay',
  'watermark',
  'icon',
  'offlinePicture',
  'offlineSoundtrack',
  'name',
  'transcoding',
  'number',
];

export type ContextChannel = Pick<
  ImmutableChannel & { offlinePicture?: string; offlineSoundtrack?: string },
  TupleToUnion<typeof CHANNEL_CONTEXT_KEYS>
>;

export type EventMap = {
  [key: string]: (...args: any[]) => void;
};

export type TypedEventEmitter<Events extends EventMap> = {
  addListener<E extends keyof Events>(
    event: E,
    listener: Events[E],
  ): TypedEventEmitter<Events>;
  on<E extends keyof Events>(
    event: E,
    listener: Events[E],
  ): TypedEventEmitter<Events>;
  once<E extends keyof Events>(
    event: E,
    listener: Events[E],
  ): TypedEventEmitter<Events>;
  prependListener<E extends keyof Events>(
    event: E,
    listener: Events[E],
  ): TypedEventEmitter<Events>;
  prependOnceListener<E extends keyof Events>(
    event: E,
    listener: Events[E],
  ): TypedEventEmitter<Events>;

  off<E extends keyof Events>(
    event: E,
    listener: Events[E],
  ): TypedEventEmitter<Events>;
  removeAllListeners<E extends keyof Events>(
    event?: E,
  ): TypedEventEmitter<Events>;
  removeListener<E extends keyof Events>(
    event: E,
    listener: Events[E],
  ): TypedEventEmitter<Events>;

  emit<E extends keyof Events>(
    event: E,
    ...args: Parameters<Events[E]>
  ): boolean;
  // The sloppy `eventNames()` return type is to mitigate type incompatibilities - see #5
  eventNames(): (keyof Events | string | symbol)[];
  rawListeners<E extends keyof Events>(event: E): Events[E][];
  listeners<E extends keyof Events>(event: E): Events[E][];
  listenerCount<E extends keyof Events>(event: E): number;

  getMaxListeners(): number;
  setMaxListeners(maxListeners: number): TypedEventEmitter<Events>;
};
