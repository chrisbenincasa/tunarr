// These types are like the DAO Lineup types in Lineup.ts
// but contain a bit more context and are used during an
// active streaming session

type BaseStreamLineupItem = {
  err?: Error;
  originalT0?: number;
  streamDuration?: number;
  beginningOffset?: number;
  title?: string;
  type: 'offline' | 'loading' | 'commercial' | 'program' | 'redirect';
  start?: number;
};

export type StreamLineupItem =
  | OfflineStreamLineupItem
  | ProgramStreamLineupItem
  | CommercialStreamLineupItem
  | LoadingStreamLineupItem
  | RedirectStreamLineupItem;

export function isOfflineLineupItem(
  item: StreamLineupItem,
): item is OfflineStreamLineupItem | RedirectStreamLineupItem {
  return item.type === 'offline' || item.type === 'redirect';
}

export function isCommercialLineupItem(
  item: StreamLineupItem,
): item is CommercialStreamLineupItem {
  return item.type === 'commercial';
}

export function isProgramLineupItem(
  item: StreamLineupItem,
): item is ProgramStreamLineupItem {
  return item.type === 'program';
}

export function isPlexBackedLineupItem(
  item: StreamLineupItem,
): item is ContentBackedStreamLineupItem {
  return isCommercialLineupItem(item) || isProgramLineupItem(item);
}

export type ContentBackedStreamLineupItem =
  | CommercialStreamLineupItem
  | ProgramStreamLineupItem;

export type OfflineStreamLineupItem = BaseStreamLineupItem & {
  type: 'offline';
  duration: number;
};

export type LoadingStreamLineupItem = BaseStreamLineupItem & {
  type: 'loading';
  streamDuration: number;
  duration: number;
};

export type CommercialStreamLineupItem = BaseStreamLineupItem & {
  type: 'commercial';
  key: string;
  plexFile: string;
  file: string;
  ratingKey: string;
  streamDuration: number;
  beginningOffset: number;
  duration: number;
  serverKey: string;
  fillerId: string;
};

export type ProgramStreamLineupItem = BaseStreamLineupItem & {
  type: 'program';
  key: string;
  plexFile: string;
  file: string;
  ratingKey: string;
  streamDuration?: number;
  beginningOffset?: number;
  duration: number;
  serverKey: string;
  title: string;
};

export type RedirectStreamLineupItem = Partial<
  Omit<ProgramStreamLineupItem, 'type'>
> & {
  type: 'redirect';
  channel: number;
  duration: number;
};

export function createOfflineStreamLineupIteam(
  duration: number,
): OfflineStreamLineupItem {
  return {
    duration,
    start: 0,
    type: 'offline',
  };
}
