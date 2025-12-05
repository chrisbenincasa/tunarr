import { z } from 'zod';
import { ChannelSchema } from '../schemas/channelSchema.js';
import { CustomShowSchema } from '../schemas/customShowsSchema.js';
import { FillerListSchema } from '../schemas/fillerSchema.js';
import { Show } from '../schemas/programmingSchema.js';
import {
  BaseSlotOrdering,
  CustomShowProgrammingSlotSchema,
  FillerProgrammingSlotSchema,
  FlexProgrammingSlotSchema,
  RedirectProgrammingSlotSchema,
  ShowProgrammingSlotSchema,
  Slot,
  SmartCollectionProgrammingSlot,
} from './CommonSlots.js';

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

export const BaseRandomSlotSchema = z.object({
  cooldownMs: z.number(),
  periodMs: z.number().optional(),
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
  ...BaseSlotOrdering.shape,
  type: z.literal('movie'),
});

export const ShowProgrammingRandomSlotSchema = z.object({
  ...Slot.shape,
  ...BaseRandomSlotSchema.shape,
  ...BaseSlotOrdering.shape,
  ...ShowProgrammingSlotSchema.shape,
});

export const MaterializedShowRandomSlot = z.object({
  ...ShowProgrammingRandomSlotSchema.shape,
  show: Show.nullable(),
  missingShow: z
    .object({
      title: z.string().optional(),
    })
    .optional()
    .describe(
      'A show that existed in the DB at schedule time, but no longer exists.',
    ),
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
  channel: ChannelSchema.nullable(),
  isMissing: z.boolean().optional().default(false),
});

export const CustomShowProgrammingRandomSlotSchema = z.object({
  ...Slot.shape,
  ...BaseRandomSlotSchema.shape,
  ...BaseSlotOrdering.shape,
  ...CustomShowProgrammingSlotSchema.shape,
});

export const MaterializedCustomShowRandomSlot = z.object({
  ...CustomShowProgrammingRandomSlotSchema.shape,
  customShow: CustomShowSchema.omit({
    programs: true,
    totalDuration: true,
  }).nullable(),
  isMissing: z.boolean().optional().default(false),
});

export type MaterializedCustomShowRandomSlot = z.infer<
  typeof MaterializedCustomShowRandomSlot
>;

export const FillerProgrammingRandomSlotSchema = z.object({
  ...BaseRandomSlotSchema.shape,
  ...FillerProgrammingSlotSchema.shape,
});

export const MaterializedFillerRandomSlotSchema = z.object({
  ...FillerProgrammingRandomSlotSchema.shape,
  fillerList: FillerListSchema.omit({ programs: true }).nullable(),
  isMissing: z.boolean().optional().default(false),
});

export const SmartCollectionRandomSlot = z.object({
  ...Slot.shape,
  ...BaseRandomSlotSchema.shape,
  ...BaseSlotOrdering.shape,
  ...SmartCollectionProgrammingSlot.shape,
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
  typeof CustomShowProgrammingRandomSlotSchema
>;

export type SmartCollectionRandomSlot = z.infer<
  typeof SmartCollectionRandomSlot
>;

export const RandomSlotSchema = z.discriminatedUnion('type', [
  MovieProgrammingRandomSlotSchema,
  ShowProgrammingRandomSlotSchema,
  FlexProgrammingRandomSlotSchema,
  RedirectProgrammingRandomSlotSchema,
  CustomShowProgrammingRandomSlotSchema,
  FillerProgrammingRandomSlotSchema,
  SmartCollectionRandomSlot,
]);

export type RandomSlot = z.infer<typeof RandomSlotSchema>;

export const MaterializedSlot = z.discriminatedUnion('type', [
  MovieProgrammingRandomSlotSchema,
  MaterializedShowRandomSlot,
  FlexProgrammingRandomSlotSchema,
  MaterializedRedirectRandomSlot,
  MaterializedCustomShowRandomSlot,
  MaterializedFillerRandomSlotSchema,
  SmartCollectionRandomSlot,
]);

export type MaterializedSlot = z.infer<typeof MaterializedSlot>;

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
