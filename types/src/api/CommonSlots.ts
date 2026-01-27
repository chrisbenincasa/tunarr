import { z } from 'zod';

export const SlotProgrammingOrderSchema = z.enum([
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

export const BaseSlotOrdering = z.object({
  order: SlotProgrammingOrderSchema,
  direction: z.enum(['asc', 'desc']).default('asc'),
});

export const CountFillMode = z.object({
  type: z.literal('count'),
  count: z.coerce.number().int().positive(),
});

export const RandomFillMode = z.object({
  type: z.literal('random'),
});

export const DurationFillMode = z.object({
  type: z.literal('duration'),
  duration: z.coerce.number().int().positive(),
});

export const CollectionSizeFillMode = z.object({
  type: z.literal('size'),
});

export const SlotFillMode = z.discriminatedUnion('type', [
  CountFillMode,
  RandomFillMode,
  DurationFillMode,
  CollectionSizeFillMode,
]);

export const SlotFillerTypes = z.enum([
  'head',
  'pre',
  'post',
  'tail',
  'fallback',
]);

export type SlotFillerTypes = z.infer<typeof SlotFillerTypes>;

export const FillerPlaybackMode = z.discriminatedUnion('type', [
  z.object({ type: z.literal('relaxed') }),
  z.object({ type: z.literal('count'), count: z.number().int().positive() }),
  z.object({
    type: z.literal('duration'),
    durationMs: z.number().int().positive(),
  }),
  z.object({
    type: z.literal('random_count'),
    min: z.number().int().min(1).optional(),
    max: z.number().int().positive().optional(),
  }),
]);

export type FillerPlaybackMode = z.infer<typeof FillerPlaybackMode>;

export const LegacySlotFiller = z.object({
  types: SlotFillerTypes.array(),
  fillerListId: z.uuid(),
  fillerOrder: SlotProgrammingFillerOrder.optional().default(
    'shuffle_prefer_short',
  ),
  // playbackMode: FillerPlaybackMode.optional().default({ type: 'relaxed' }),
});

export const SlotFiller = z.object({
  type: SlotFillerTypes,
  fillerListId: z.uuid(),
  fillerOrder: SlotProgrammingFillerOrder.optional().default(
    'shuffle_prefer_short',
  ),
  playbackMode: FillerPlaybackMode.optional().default({ type: 'relaxed' }),
});

export type SlotFiller = z.infer<typeof SlotFiller>;

export const Slot = z.object({
  filler: z.array(LegacySlotFiller).optional(),
});

//
// Base slots
//

export const MovieProgrammingSlotSchema = z.object({
  type: z.literal('movie'),
  ...BaseSlotOrdering.shape,
  ...Slot.shape,
});

export type BaseMovieProgrammingSlot = z.infer<
  typeof MovieProgrammingSlotSchema
>;

export const ShowProgrammingSlotSchema = z.object({
  type: z.literal('show'),
  showId: z.string(),
  seasonFilter: z.number().array().default([]).catch([]),
  ...BaseSlotOrdering.shape,
  ...Slot.shape,
});

export type BaseShowProgrammingSlot = z.infer<typeof ShowProgrammingSlotSchema>;

export const FlexProgrammingSlotSchema = z.object({
  type: z.literal('flex'),
});

export const RedirectProgrammingSlotSchema = z.object({
  type: z.literal('redirect'),
  channelId: z.string(),
  channelName: z.string().optional(),
});

export const CustomShowProgrammingSlotSchema = z.object({
  type: z.literal('custom-show'),
  customShowId: z.uuid(),
  ...BaseSlotOrdering.shape,
  ...Slot.shape,
});

export type BaseCustomShowProgrammingSlot = z.infer<
  typeof CustomShowProgrammingSlotSchema
>;

export const FillerProgrammingSlotSchema = z.object({
  type: z.literal('filler'),
  fillerListId: z.uuid(),
  order: SlotProgrammingFillerOrder,
  durationWeighting: z.enum(['linear', 'log']),
  decayFactor: z.number().gte(0).lt(1),
  recoveryFactor: z.number().gte(0).lt(1),
});

export type FillerProgrammingSlot = z.infer<typeof FillerProgrammingSlotSchema>;

export const SmartCollectionProgrammingSlot = z.object({
  type: z.literal('smart-collection'),
  smartCollectionId: z.uuid(),
  ...BaseSlotOrdering.shape,
  ...Slot.shape,
});

export const BaseSlotSchema = z.discriminatedUnion('type', [
  MovieProgrammingSlotSchema,
  ShowProgrammingSlotSchema,
  FlexProgrammingSlotSchema,
  RedirectProgrammingSlotSchema,
  CustomShowProgrammingSlotSchema,
  FillerProgrammingSlotSchema,
  SmartCollectionProgrammingSlot,
]);

export type BaseSlot = z.infer<typeof BaseSlotSchema>;
