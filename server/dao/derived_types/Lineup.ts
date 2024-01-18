import { Program as ProgramDTO } from 'dizquetv-types';
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

// type ScheduleSlot = {

// }

export type MovieProgrammingSlot = {
  type: 'movie';
  sortType: '';
};

export type ShowProgrammingSlot = {
  type: 'show';
  showId: string; // grandparent id
};

export type FlexProgrammingSlot = {
  type: 'flex';
};

export function slotProgrammingId(slot: SlotProgramming) {
  if (slot.type === 'movie' || slot.type === 'flex') {
    return slot.type;
  } else {
    return `show.${slot.showId}`;
  }
}

export type SlotProgramming =
  | MovieProgrammingSlot
  | ShowProgrammingSlot
  | FlexProgrammingSlot;

export type TimeSlot = {
  order: 'next' | 'shuffle';
  programming: SlotProgramming;
  startTime: number; // Offset from midnight in millis
};

// type SlotBasedSchedule<T extends ScheduleSlot> = {
//   type: string,
//   slots: T[],
//   timeZoneOffset: number; // time zone offset in millis
//   flexPreference: 'distribute' | 'end';
// }

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

export type RandomSlot = {
  order: string;
  showId: string;
  startTime?: number; // Offset from midnight in millis
  cooldown: number;
  periodMs?: number;
  durationMs: number;
  weight?: number;
  weightPercentage?: string; // Frontend specific?
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
