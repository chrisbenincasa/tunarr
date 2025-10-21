import { z } from 'zod/v4';
import { ChannelSchema } from '../schemas/channelSchema.js';
import { CustomShowSchema } from '../schemas/customShowsSchema.js';
import { FillerListSchema } from '../schemas/fillerSchema.js';
import { Show } from '../schemas/programmingSchema.js';
import { PlexSearchSchema } from './plexSearch.js';

const SlotProgrammingOrderSchema = z.enum([
  'next',
  'shuffle',
  'ordered_shuffle',
  'alphanumeric',
  'chronological',
]);

export const SlotProgrammingFillerOrder = z.enum([
  'shuffle_prefer_short',
  'shuffle_prefer_long',
  'uniform',
]);

const BaseSlotOrdering = z.object({
  order: SlotProgrammingOrderSchema,
  direction: z.enum(['asc', 'desc']).default('asc'),
});

export const SlotFillerTypes = z.enum([
  'head',
  'pre',
  'post',
  'tail',
  'fallback',
]);

export type SlotFillerTypes = z.infer<typeof SlotFillerTypes>;

export const SlotFiller = z.object({
  types: z.array(SlotFillerTypes).nonempty(),
  fillerListId: z.uuid(),
  fillerOrder: SlotProgrammingFillerOrder.optional().default(
    'shuffle_prefer_short',
  ),
});

export type SlotFiller = z.infer<typeof SlotFiller>;

const Slot = z.object({
  filler: z.array(SlotFiller).optional(),
});

//
// Base slots
//
const MovieProgrammingSlotSchema = z.object({
  type: z.literal('movie'),
  ...BaseSlotOrdering.shape,
  ...Slot.shape,
});

export type BaseMovieProgrammingSlot = z.infer<
  typeof MovieProgrammingSlotSchema
>;

const ShowProgrammingSlotSchema = z.object({
  type: z.literal('show'),
  showId: z.string(),
  ...BaseSlotOrdering.shape,
  ...Slot.shape,
});

export type BaseShowProgrammingSlot = z.infer<typeof ShowProgrammingSlotSchema>;

const FlexProgrammingSlotSchema = z.object({
  type: z.literal('flex'),
  ...BaseSlotOrdering.shape,
});

const RedirectProgrammingSlotSchema = z.object({
  type: z.literal('redirect'),
  channelId: z.string(),
  channelName: z.string().optional(),
  ...BaseSlotOrdering.shape,
});

const CustomShowProgrammingSlotSchema = z.object({
  type: z.literal('custom-show'),
  customShowId: z.uuid(),
  ...BaseSlotOrdering.shape,
  ...Slot.shape,
});

export type BaseCustomShowProgrammingSlot = z.infer<
  typeof CustomShowProgrammingSlotSchema
>;

const FillerProgrammingSlotSchema = z.object({
  type: z.literal('filler'),
  fillerListId: z.uuid(),
  order: SlotProgrammingFillerOrder,
  durationWeighting: z.enum(['linear', 'log']),
  decayFactor: z.number().gte(0).lt(1),
  recoveryFactor: z.number().gte(0).lt(1),
});

export type FillerProgrammingSlot = z.infer<typeof FillerProgrammingSlotSchema>;

export const BaseSlotSchema = z.discriminatedUnion('type', [
  MovieProgrammingSlotSchema,
  ShowProgrammingSlotSchema,
  FlexProgrammingSlotSchema,
  RedirectProgrammingSlotSchema,
  CustomShowProgrammingSlotSchema,
  FillerProgrammingSlotSchema,
]);

export type BaseSlot = z.infer<typeof BaseSlotSchema>;

//
// Time slots
//

const BaseTimeSlot = z.object({
  startTime: z.number(), // Offset from midnight in millis
});

export const MovieProgrammingTimeSlotSchema = z.object({
  ...BaseTimeSlot.shape,
  ...MovieProgrammingSlotSchema.shape,
});

export const ShowProgrammingTimeSlotSchema = z.object({
  ...BaseTimeSlot.shape,
  ...ShowProgrammingSlotSchema.shape,
});

export const MaterializedShowTimeSlot = z.object({
  ...ShowProgrammingTimeSlotSchema.shape,
  show: Show,
});

export const FlexProgrammingTimeSlotSchema = z.object({
  ...BaseTimeSlot.shape,
  ...FlexProgrammingSlotSchema.shape,
});

export const RedirectProgrammingTimeSlotSchema =
  RedirectProgrammingSlotSchema.extend(BaseTimeSlot.shape);

export const MaterializedRedirectTimeSlot = z.object({
  ...RedirectProgrammingTimeSlotSchema.shape,
  channel: ChannelSchema,
});
export type MaterializedRedirectTimeSlot = z.infer<
  typeof MaterializedRedirectTimeSlot
>;

export const CustomShowProgrammingTimeSlotSchema =
  CustomShowProgrammingSlotSchema.extend(BaseTimeSlot.shape);

export const MaterializedCustomShowTimeSlot = z.object({
  ...CustomShowProgrammingTimeSlotSchema.shape,
  customShow: CustomShowSchema.omit({ programs: true, totalDuration: true }),
});

export type MaterializedCustomShowTimeSlot = z.infer<
  typeof MaterializedCustomShowTimeSlot
>;

export const FillerShowProgrammingTimeSlotSchema =
  FillerProgrammingSlotSchema.extend(BaseTimeSlot.shape);

export const MaterializedFillerTimeSlot = z.object({
  ...FillerShowProgrammingTimeSlotSchema.shape,
  fillerList: FillerListSchema.omit({ programs: true }),
});

export type MaterializedFillerTimeSlot = z.infer<
  typeof MaterializedFillerTimeSlot
>;

export type MovieProgrammingTimeSlot = z.infer<
  typeof MovieProgrammingTimeSlotSchema
>;

export type ShowProgrammingTimeSlot = z.infer<
  typeof ShowProgrammingTimeSlotSchema
>;

export type FlexProgrammingTimeSlot = z.infer<
  typeof FlexProgrammingTimeSlotSchema
>;

export type CustomShowProgrammingTimeSlot = z.infer<
  typeof CustomShowProgrammingTimeSlotSchema
>;

export type RedirectProgrammingTimeSlot = z.infer<
  typeof RedirectProgrammingTimeSlotSchema
>;

export type FillerProgrammingTimeSlot = z.infer<
  typeof FillerShowProgrammingTimeSlotSchema
>;

export const TimeSlotProgrammingSchema = z.discriminatedUnion('type', [
  MovieProgrammingTimeSlotSchema,
  ShowProgrammingTimeSlotSchema,
  FlexProgrammingTimeSlotSchema,
  RedirectProgrammingTimeSlotSchema,
  CustomShowProgrammingTimeSlotSchema,
  FillerProgrammingSlotSchema,
]);

export type TimeSlotProgramming = z.infer<typeof TimeSlotProgrammingSchema>;

export const TimeSlotSchema = z.discriminatedUnion('type', [
  MovieProgrammingTimeSlotSchema,
  ShowProgrammingTimeSlotSchema,
  FlexProgrammingTimeSlotSchema,
  RedirectProgrammingTimeSlotSchema,
  FillerShowProgrammingTimeSlotSchema,
  CustomShowProgrammingTimeSlotSchema,
]);

export type TimeSlot = z.infer<typeof TimeSlotSchema>;

export const MaterializedTimeSlot = z.discriminatedUnion('type', [
  MovieProgrammingTimeSlotSchema,
  MaterializedShowTimeSlot,
  FlexProgrammingTimeSlotSchema,
  MaterializedRedirectTimeSlot,
  MaterializedCustomShowTimeSlot,
  MaterializedFillerTimeSlot,
]);

export type MaterializedTimeSlot = z.infer<typeof MaterializedTimeSlot>;

export const TimeSlotScheduleSchema = z.object({
  type: z.literal('time'),
  flexPreference: z.enum(['distribute', 'end']),
  latenessMs: z.number(), // max lateness in millis
  maxDays: z.number(), // days to pregenerate schedule for
  padMs: z.number(), // Pad time in millis
  period: z.enum(['day', 'week', 'month']),
  slots: z.array(TimeSlotSchema),
  timeZoneOffset: z.number(), // tz offset in...minutes, i think?
  startTomorrow: z.boolean().optional(),
});

export type TimeSlotSchedule = z.infer<typeof TimeSlotScheduleSchema>;

//
// Random slots
//

export const RandomSlotFixedDurationSpecSchema = z.object({
  durationMs: z.number(),
  type: z.literal('fixed'),
});

export const RandomSlotDynamicDurationspecSchema = z.object({
  type: z.literal('dynamic'),
  programCount: z.number().min(1),
});

export const RandomSlotDurationSpec = z.discriminatedUnion('type', [
  RandomSlotFixedDurationSpecSchema,
  RandomSlotDynamicDurationspecSchema,
]);

export type RandomSlotDurationSpec = z.infer<typeof RandomSlotDurationSpec>;

const BaseRandomSlotSchema = z.object({
  order: SlotProgrammingOrderSchema,
  direction: z.enum(['asc', 'desc']).default('asc'),
  startTime: z.number().optional(), // Offset from midnight millis
  cooldownMs: z.number(),
  periodMs: z.number().optional(),
  // Deprecated -  use durationSpec
  durationMs: z.number().optional(),
  durationSpec: RandomSlotDurationSpec.default({
    type: 'dynamic',
    programCount: 1,
  }),
  weight: z.number(),
  index: z.number().optional(),
});

export const MovieProgrammingRandomSlotSchema = z.object({
  ...Slot.shape,
  ...BaseRandomSlotSchema.shape,
  type: z.literal('movie'),
});

export const ShowProgrammingRandomSlotSchema = z.object({
  ...Slot.shape,
  ...BaseRandomSlotSchema.shape,
  ...ShowProgrammingSlotSchema.shape,
});

export const MaterializedShowRandomSlot = z.object({
  ...ShowProgrammingRandomSlotSchema.shape,
  show: Show,
});

export const FlexProgrammingRandomSlotSchema = z.object({
  ...BaseRandomSlotSchema.shape,
  ...FlexProgrammingSlotSchema.shape,
});

export const RedirectProgrammingRandomSlotSchema = z.object({
  ...BaseRandomSlotSchema.shape,
  ...RedirectProgrammingSlotSchema.shape,
});

export const MaterializedRedirectRandomSlot = z.object({
  ...RedirectProgrammingRandomSlotSchema.shape,
  channel: ChannelSchema,
});

export const CustomShowProgrammingRandomSchema = z.object({
  ...Slot.shape,
  ...BaseRandomSlotSchema.shape,
  ...CustomShowProgrammingSlotSchema.shape,
});

export const FillerProgrammingRandomSlotSchema = z.object({
  ...BaseRandomSlotSchema.shape,
  ...FillerProgrammingSlotSchema.shape,
});

export type MovieProgrammingRandomSlot = z.infer<
  typeof MovieProgrammingRandomSlotSchema
>;

export type ShowProgrammingRandomSlot = z.infer<
  typeof ShowProgrammingRandomSlotSchema
>;

export type FlexProgrammingRandomSlot = z.infer<
  typeof FlexProgrammingRandomSlotSchema
>;

export type RedirectProgrammingRandomSlot = z.infer<
  typeof RedirectProgrammingRandomSlotSchema
>;

export type CustomShowProgrammingRandom = z.infer<
  typeof CustomShowProgrammingRandomSchema
>;

export const RandomSlotSchema = z.discriminatedUnion('type', [
  MovieProgrammingRandomSlotSchema,
  ShowProgrammingRandomSlotSchema,
  FlexProgrammingRandomSlotSchema,
  RedirectProgrammingRandomSlotSchema,
  CustomShowProgrammingRandomSchema,
  FillerProgrammingRandomSlotSchema,
]);

export type RandomSlot = z.infer<typeof RandomSlotSchema>;

export const MaterializedRandomSlot = z.discriminatedUnion('type', [
  MovieProgrammingRandomSlotSchema,
  MaterializedShowRandomSlot,
  FlexProgrammingRandomSlotSchema,
  MaterializedRedirectRandomSlot,
  CustomShowProgrammingRandomSchema,
  FillerProgrammingRandomSlotSchema,
]);

export const RandomSlotDistributionTypeSchema = z.enum([
  'uniform',
  'weighted',
  'none',
]);

export type RandomSlotDistributionType = z.infer<
  typeof RandomSlotDistributionTypeSchema
>;

export const RandomSlotScheduleSchema = z.object({
  type: z.literal('random'),
  flexPreference: z.enum(['distribute', 'end']),
  maxDays: z.number(),
  padMs: z.number(),
  padStyle: z.enum(['slot', 'episode']),
  slots: z.array(RandomSlotSchema),
  timeZoneOffset: z.number().optional(), // Timezone offset in minutes
  randomDistribution: RandomSlotDistributionTypeSchema,
  periodMs: z.number().optional(),
  // Purely for UI purposes. Adjusting weight of one program affects the
  // weights of all others if lock weights === true.
  lockWeights: z.boolean().default(false),
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
