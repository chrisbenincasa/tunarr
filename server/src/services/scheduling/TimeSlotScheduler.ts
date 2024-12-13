import { ProgramDB } from '@/db/ProgramDB.ts';

interface BaseSlotProgramming {
  order: 'next' | 'shuffle';
}

// Show, season, artist, album
interface GroupingSlot extends BaseSlotProgramming {
  type: 'grouping';
  groupingId: string;
}

interface CustomShowSlot extends BaseSlotProgramming {
  type: 'custom_show';
  customShowId: string;
}

interface FlexSlot extends BaseSlotProgramming {
  type: 'flex';
}

interface RedirectSlot extends BaseSlotProgramming {
  type: 'redirect';
  channelId: string;
}

type SlotProgramming = GroupingSlot | CustomShowSlot | FlexSlot | RedirectSlot;

interface BaseSlot {
  programming: SlotProgramming;
  startTimeOffset: number;
}

interface RandomSlot extends BaseSlot {
  type: 'random';
  seed: number;
}

interface OrderedSlot extends BaseSlot {
  type: 'ordered';
}

type Slot = RandomSlot | OrderedSlot;

export type Schedule = {
  flexPreference: 'distribute' | 'end';
  maxLatenessMs: number; // max lateness in millis
  // maxDays: z.number(), // days to pregenerate schedule for
  padMs: number; // Pad time in millis
  period: 'day' | 'week'; //z.union([z.literal('day'), z.literal('week'), z.literal('month')]),
  slots: Slot[];
};

export class TimeSlotScheduler {
  constructor(private programDB: ProgramDB) {}

  async schedule(schedule: Schedule) {
    schedule.slots;
  }
}
