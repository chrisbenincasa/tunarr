import { Program as ProgramDTO } from '@tunarr/types';
import { Program } from '../entities/Program.js';

export type Lineup = {
  items: LineupItem[];
  schedule?: LineupSchedule;
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

export type MovieProgrammingTimeSlot = {
  type: 'movie';
  sortType: '';
};

export type ShowProgrammingTimeSlot = {
  type: 'show';
  showId: string; // grandparent id
};

export type FlexProgrammingTimeSlot = {
  type: 'flex';
};

export function slotProgrammingId(slot: TimeSlotProgramming) {
  if (slot.type === 'movie' || slot.type === 'flex') {
    return slot.type;
  } else {
    return `show.${slot.showId}`;
  }
}

export type TimeSlotProgramming =
  | MovieProgrammingTimeSlot
  | ShowProgrammingTimeSlot
  | FlexProgrammingTimeSlot;

export type TimeSlot = {
  order: 'next' | 'shuffle';
  programming: TimeSlotProgramming;
  startTime: number; // Offset from midnight in millis
};

// Zod these up
export type TimeSlotSchedule = {
  type: 'time';
  flexPreference: 'distribute' | 'end';
  latenessMs: number; // max lateness in millis
  maxDays: number; // days to pregenerate schedule for
  padMs: number; // Pad time in millis
  period: 'day' | 'week' | 'month';
  slots: TimeSlot[];
  timeZoneOffset: number; // tz offset in...minutes, i think?
  startTomorrow?: boolean;
};

export type MovieProgrammingRandomSlot = {
  type: 'movie';
};

export type ShowProgrammingRandomSlot = {
  type: 'show';
  showId: string;
};

export type FlexProgrammingRandomSlot = {
  type: 'flex';
};

export type RandomSlotProgramming =
  | MovieProgrammingRandomSlot
  | ShowProgrammingRandomSlot
  | FlexProgrammingRandomSlot;

export type RandomSlot = {
  order: string;
  startTime?: number; // Offset from midnight millis
  cooldown: number;
  periodMs?: string;
  durationMs: number;
  weight?: number;
  weightPercentage?: string; // Frontend specific?
  programming: RandomSlotProgramming;
};

// This is used on the frontend too, we will move common
// types eventually.
export type RandomSlotSchedule = {
  type: 'random';
  flexPreference: 'distribute' | 'end'; // distribute or end
  maxDays: number; // days
  padMs: number; // Pad time in millis
  padStyle: 'slot' | 'episode';
  slots: RandomSlot[];
  timeZoneOffset?: number; // tz offset in...minutes, i think?
  randomDistribution: 'uniform' | 'weighted';
  periodMs?: number;
};

export type LineupSchedule = TimeSlotSchedule | RandomSlotSchedule;

export function contentItemToProgramDTO(
  backingItem: Program,
): Partial<ProgramDTO> {
  return {
    ...backingItem.toDTO(),
  };
}
