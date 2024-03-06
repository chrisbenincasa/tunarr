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

export const MovieProgrammingRandomSlotSchema = z.object({
  type: z.literal('movie'),
});

export type MovieProgrammingRandomSlot = Alias<
  z.infer<typeof MovieProgrammingRandomSlotSchema>
>;

export const ShowProgrammingRandomSlotSchema = z.object({
  type: z.literal('show'),
  showId: z.string(),
});

export type ShowProgrammingRandomSlot = Alias<
  z.infer<typeof ShowProgrammingRandomSlotSchema>
>;

export const FlexProgrammingRandomSlotSchema = z.object({
  type: z.literal('flex'),
});

export type FlexProgrammingRandomSlot = Alias<
  z.infer<typeof FlexProgrammingRandomSlotSchema>
>;

export const RandomSlotProgrammingSchema = z.discriminatedUnion('type', [
  MovieProgrammingRandomSlotSchema,
  ShowProgrammingRandomSlotSchema,
  FlexProgrammingRandomSlotSchema,
]);

export type RandomSlotProgramming = Alias<
  z.infer<typeof RandomSlotProgrammingSchema>
>;

export const RandomSlotSchema = z.object({
  order: z.string().optional(), // Present for show slots only
  startTime: z.number().optional(), // Offset from midnight millis
  cooldownMs: z.number(),
  periodMs: z.number().optional(),
  durationMs: z.number(),
  weight: z.number(),
  programming: RandomSlotProgrammingSchema,
});

export type RandomSlot = Alias<z.infer<typeof RandomSlotSchema>>;

export const RandomSlotScheduleSchema = z.object({
  type: z.literal('random'),
  flexPreference: z.union([z.literal('distribute'), z.literal('end')]),
  maxDays: z.number(),
  padMs: z.number(),
  padStyle: z.union([z.literal('slot'), z.literal('episode')]),
  slots: z.array(RandomSlotSchema),
  timeZoneOffset: z.number().optional(), // Timezone offset in minutes
  randomDistribution: z.union([z.literal('uniform'), z.literal('weighted')]),
  periodMs: z.number().optional(),
});

// This is used on the frontend too, we will move common
// types eventually.
export type RandomSlotSchedule = Alias<
  z.infer<typeof RandomSlotScheduleSchema>
>;

export const LineupScheduleSchema = z.discriminatedUnion('type', [
  TimeSlotScheduleSchema,
  RandomSlotScheduleSchema,
]);

export type LineupSchedule = Alias<z.infer<typeof LineupScheduleSchema>>;
