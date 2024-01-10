import { Program as ProgramDTO } from 'dizquetv-types';
import { Program } from '../entities/Program.js';

export type Lineup = {
  items: LineupItem[];
};

type BaseLineupItem = {
  durationMs: number;
};

// This item has to be hydrated from the DB
export type ContentItem = BaseLineupItem & {
  type: 'content';
  id: string;
};

export type OfflineItem = BaseLineupItem & {
  type: 'offline';
};

export type RedirectItem = BaseLineupItem & {
  type: 'redirect';
  channel: number;
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

export function contentItemToProgramDTO(
  backingItem: Program,
): Partial<ProgramDTO> {
  return {
    ...backingItem.toDTO(),
  };
}
