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

export const Slot = z.object({
  filler: z.array(SlotFiller).optional(),
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
