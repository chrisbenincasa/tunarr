import { z } from 'zod';

type Alias<T> = T & { _?: never };

export const MovieProgrammingTimeSlotSchema = z.object({
  type: z.literal('movie'),
});
export const ShowProgrammingTimeSlotSchema = z.object({
  type: z.literal('show'),
  showId: z.string(),
});
export const FlexProgrammingTimeSlotSchema = z.object({
  type: z.literal('flex'),
});

export type MovieProgrammingTimeSlot = Alias<
  z.infer<typeof MovieProgrammingTimeSlotSchema>
>;

export type ShowProgrammingTimeSlot = Alias<
  z.infer<typeof ShowProgrammingTimeSlotSchema>
>;

export type FlexProgrammingTimeSlot = Alias<
  z.infer<typeof FlexProgrammingTimeSlotSchema>
>;

export function slotProgrammingId(slot: TimeSlotProgramming) {
  if (slot.type === 'movie' || slot.type === 'flex') {
    return slot.type;
  } else {
    return `show.${slot.showId}`;
  }
}

export const TimeSlotProgrammingSchema = z.discriminatedUnion('type', [
  MovieProgrammingTimeSlotSchema,
  ShowProgrammingTimeSlotSchema,
  FlexProgrammingTimeSlotSchema,
]);

export type TimeSlotProgramming = Alias<
  z.infer<typeof TimeSlotProgrammingSchema>
>;

export const TimeSlotSchema = z.object({
  order: z.union([z.literal('next'), z.literal('shuffle')]),
  programming: TimeSlotProgrammingSchema,
  startTime: z.number(), // Offset from midnight in millis
});

export type TimeSlot = Alias<z.infer<typeof TimeSlotSchema>>;

export const TimeSlotScheduleSchema = z.object({
  type: z.literal('time'),
  flexPreference: z.union([z.literal('distribute'), z.literal('end')]),
  latenessMs: z.number(), // max lateness in millis
  maxDays: z.number(), // days to pregenerate schedule for
  padMs: z.number(), // Pad time in millis
  period: z.union([z.literal('day'), z.literal('week'), z.literal('month')]),
  slots: z.array(TimeSlotSchema),
  timeZoneOffset: z.number(), // tz offset in...minutes, i think?
  startTomorrow: z.boolean().optional(),
});

export type TimeSlotSchedule = Alias<z.infer<typeof TimeSlotScheduleSchema>>;

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
