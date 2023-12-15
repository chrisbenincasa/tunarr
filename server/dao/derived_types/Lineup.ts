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

export function isContentItem(item: LineupItem): item is ContentItem {
  return item.type === 'content';
}

export function isOfflineItem(item: LineupItem): item is OfflineItem {
  return item.type === 'offline';
}

export function contentItemToProgramDTO(
  backingItem: Program,
): Partial<ProgramDTO> {
  return {
    ...backingItem.toDTO(),
  };
}
