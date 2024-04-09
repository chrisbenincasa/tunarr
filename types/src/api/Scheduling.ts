import { z } from 'zod';
import { PlexSearchSchema } from './plexSearch.js';

//
// Time slots
//

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

export const RedirectProgrammingTimeSlotSchema = z.object({
  type: z.literal('redirect'),
  channelId: z.string(),
});

export type MovieProgrammingTimeSlot = z.infer<
  typeof MovieProgrammingTimeSlotSchema
>;

export type ShowProgrammingTimeSlot = z.infer<
  typeof ShowProgrammingTimeSlotSchema
>;

export type FlexProgrammingTimeSlot = z.infer<
  typeof FlexProgrammingTimeSlotSchema
>;

export function slotProgrammingId(slot: TimeSlotProgramming) {
  if (slot.type === 'movie' || slot.type === 'flex') {
    return slot.type;
  } else if (slot.type === 'redirect') {
    return `redirect.${slot.channelId}`;
  } else {
    return `show.${slot.showId}`;
  }
}

export const TimeSlotProgrammingSchema = z.discriminatedUnion('type', [
  MovieProgrammingTimeSlotSchema,
  ShowProgrammingTimeSlotSchema,
  FlexProgrammingTimeSlotSchema,
  RedirectProgrammingTimeSlotSchema,
]);

export type TimeSlotProgramming = z.infer<typeof TimeSlotProgrammingSchema>;

export const TimeSlotSchema = z.object({
  order: z.union([z.literal('next'), z.literal('shuffle')]),
  programming: TimeSlotProgrammingSchema,
  startTime: z.number(), // Offset from midnight in millis
});

export type TimeSlot = z.infer<typeof TimeSlotSchema>;

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

export type TimeSlotSchedule = z.infer<typeof TimeSlotScheduleSchema>;

//
// Random slots
//

export const MovieProgrammingRandomSlotSchema = z.object({
  type: z.literal('movie'),
});

export type MovieProgrammingRandomSlot = z.infer<
  typeof MovieProgrammingRandomSlotSchema
>;

export const ShowProgrammingRandomSlotSchema = z.object({
  type: z.literal('show'),
  showId: z.string(),
});

export type ShowProgrammingRandomSlot = z.infer<
  typeof ShowProgrammingRandomSlotSchema
>;

export const FlexProgrammingRandomSlotSchema = z.object({
  type: z.literal('flex'),
});

export type FlexProgrammingRandomSlot = z.infer<
  typeof FlexProgrammingRandomSlotSchema
>;

export const RedirectProgrammingRandomSlotSchema = z.object({
  type: z.literal('redirect'),
  channelId: z.string(),
});

export type RedirectProgrammingRandomSlot = z.infer<
  typeof RedirectProgrammingRandomSlotSchema
>;

export const RandomSlotProgrammingSchema = z.discriminatedUnion('type', [
  MovieProgrammingRandomSlotSchema,
  ShowProgrammingRandomSlotSchema,
  FlexProgrammingRandomSlotSchema,
  RedirectProgrammingRandomSlotSchema,
]);

export type RandomSlotProgramming = z.infer<typeof RandomSlotProgrammingSchema>;

export const RandomSlotSchema = z.object({
  order: z.union([z.literal('next'), z.literal('shuffle')]).optional(), // Present for show slots only
  startTime: z.number().optional(), // Offset from midnight millis
  cooldownMs: z.number(),
  periodMs: z.number().optional(),
  durationMs: z.number(),
  weight: z.number(),
  programming: RandomSlotProgrammingSchema,
});

export type RandomSlot = z.infer<typeof RandomSlotSchema>;

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

export type RandomSlotSchedule = z.infer<typeof RandomSlotScheduleSchema>;

//
// Dynamic content
//
export const DynamicContentCronUpdaterConfigSchema = z.object({
  // Unique ID to track scheduling. Not for use outside of bookkeeping
  _id: z.string(),
  type: z.literal('cron'),
  // Cron schedule string compatible with node-schedule
  schedule: z.string(),
});

export type DynamicContentCronUpdaterConfig = z.infer<
  typeof DynamicContentCronUpdaterConfigSchema
>;

export const DynamicContentUpdaterConfigSchema = z.discriminatedUnion('type', [
  DynamicContentCronUpdaterConfigSchema,
]);

export type DynamicContentUpdaterConfig = z.infer<
  typeof DynamicContentUpdaterConfigSchema
>;

const WithEnabledSchema = z.object({
  enabled: z.boolean().default(true),
});

export const DynamicContentConfigPlexSourceSchema = z
  .object({
    type: z.literal('plex'),
    plexServerId: z.string().min(1), // server name or unique ID
    plexLibraryKey: z.string().min(1),
    search: PlexSearchSchema.optional(),
    updater: DynamicContentUpdaterConfigSchema,
  })
  .merge(WithEnabledSchema);

export type DynamicContentConfigPlexSource = z.infer<
  typeof DynamicContentConfigPlexSourceSchema
>;

export const DynamicContentConfigSourceSchema = z.discriminatedUnion('type', [
  DynamicContentConfigPlexSourceSchema,
]);

export type DynamicContentConfigSource = z.infer<
  typeof DynamicContentConfigSourceSchema
>;

export const DynamicContentConfigSchema = z
  .object({
    contentSources: z.array(DynamicContentConfigSourceSchema).nonempty(),
  })
  .merge(WithEnabledSchema);

export type DynamicContentConfig = z.infer<typeof DynamicContentConfigSchema>;

//
// Lineups
//
export const LineupScheduleSchema = z.discriminatedUnion('type', [
  TimeSlotScheduleSchema,
  RandomSlotScheduleSchema,
]);

export type LineupSchedule = z.infer<typeof LineupScheduleSchema>;
