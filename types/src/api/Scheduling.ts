import { z } from 'zod/v4';
import { PlexSearchSchema } from './plexSearch.js';
import { RandomSlotScheduleSchema } from './RandomSlots.js';
import { TimeSlotScheduleSchema } from './TimeSlots.js';

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
  enabled: z.boolean().default(true).catch(true),
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

//
// Tools
//

const BaseSchedulingOpertionSchema = z.object({
  allowMultiple: z.boolean().default(true).optional(),
});

const BaseSortOperationSchema = (defaultAsc: boolean = true) =>
  z.object({
    type: z.literal('ordering'),
    ascending: z.boolean().optional().default(defaultAsc).catch(defaultAsc),
  });

const RandomSortOrderOperationSchema = BaseSchedulingOpertionSchema.extend({
  type: z.literal('ordering'),
  id: z.literal('random_sort'),
});

export type RandomSortOrderOperation = z.infer<
  typeof RandomSortOrderOperationSchema
>;

const ReleaseDateSortOrderOperationSchema = BaseSchedulingOpertionSchema.merge(
  BaseSortOperationSchema(),
).extend({
  id: z.literal('release_date_sort'),
});

export type ReleaseDateSortOrderOperation = z.infer<
  typeof ReleaseDateSortOrderOperationSchema
>;

const ScheduledRedirectOperationSchema = BaseSchedulingOpertionSchema.extend({
  type: z.literal('modifier'),
  id: z.literal('scheduled_redirect'),
  channelId: z.string().uuid(),
  startHour: z.number().min(0).max(23),
  // Anything less than 30 mins doesn't really make sense?
  // And can't schedule more than 24 hours either...
  duration: z
    .number()
    .min(15 * 60 * 1000)
    .max(24 * 60 * 60 * 1000),
});

export type ScheduledRedirectOperation = z.infer<
  typeof ScheduledRedirectOperationSchema
>;

const AddPaddingOperationSchema = BaseSchedulingOpertionSchema.extend({
  type: z.literal('modifier'), // not sure I like this name yet
  id: z.literal('add_padding'), // every operation needs a unique ID
  mod: z.number(),
  allowedOffsets: z.array(z.number()).optional(),
  alignChannelStartTime: z.boolean().default(false),
  allowMultiple: z.literal(false).default(false).optional(),
});

export type AddPaddingOperation = z.infer<typeof AddPaddingOperationSchema>;

export const SchedulingOperationSchema = z.union([
  AddPaddingOperationSchema,
  ScheduledRedirectOperationSchema,
  RandomSortOrderOperationSchema,
  ReleaseDateSortOrderOperationSchema,
]);

export type SchedulingOperation = z.infer<typeof SchedulingOperationSchema>;
