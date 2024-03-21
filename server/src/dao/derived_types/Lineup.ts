import { LineupSchedule } from '@tunarr/types/api';

export type Lineup = {
  items: LineupItem[];
  // Unsure if we want this DB type to reference the
  // API type, but for now it will work.
  schedule?: LineupSchedule;
  // These are precalculated offsets in milliseconds. The
  // array is a list of the running 'total' duration sum
  // of each of the lineup items. It can be used to quickly
  // determine a start timestamp for a given program by
  // pulling the offset at a given index and adding it to
  // a "start" time timestamp.
  startTimeOffsets?: number[];
};

type BaseLineupItem = {
  durationMs: number;
};

// This item has to be hydrated from the DB
export type ContentItem = BaseLineupItem & {
  type: 'content';
  id: string;
  // If this lineup item was a part of a custom show
  // this is a pointer to that show.
  // TODO: If a custom show is deleted, we have to remove
  // references to these content items in the lineup
  customShowId?: string;
};

export type OfflineItem = BaseLineupItem & {
  type: 'offline';
};

export type RedirectItem = BaseLineupItem & {
  type: 'redirect';
  channel: string;
};

export type LineupItem = ContentItem | OfflineItem | RedirectItem;

function isItemOfType<T extends LineupItem>(discrim: string) {
  return function (t: LineupItem | undefined): t is T {
    return t?.type === discrim;
  };
}

export const isContentItem = isItemOfType<ContentItem>('content');
export const isOfflineItem = isItemOfType<OfflineItem>('offline');
export const isRedirectItem = isItemOfType<RedirectItem>('redirect');
