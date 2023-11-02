import { DbAccess, FfmpegSettings } from './dao/db.js';

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
  channel: any;
  m3u8: boolean;
  audioOnly: boolean;
  isLoading?: boolean;
  watermark?: boolean;
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
): item is CommercialLineupItem | ProgramLineupItem {
  return isCommercialLineupItem(item) || isProgramLineupItem(item);
}

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
};
