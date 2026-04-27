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
  'mid',
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

export const MidRollBreakRuleSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('fixed_interval'),
    intervalMs: z.number().positive(),
  }),
  z.object({
    type: z.literal('percentage'),
    points: z.array(z.number().gt(0).lt(100)).nonempty(),
  }),
  z.object({
    type: z.literal('initial_then_interval'),
    initialDelayMs: z.number().positive(),
    intervalMs: z.number().positive(),
  }),
]);

export type MidRollBreakRule = z.infer<typeof MidRollBreakRuleSchema>;

export const MidRollConfigSchema = z
  .object({
    // V1 simple field (kept for backward compat; ignored when breakRule is set)
    intervalMs: z.number().positive().optional(),
    // V2 structured break rule. Falls back to fixed_interval(intervalMs) if absent.
    breakRule: MidRollBreakRuleSchema.optional(),
    maxBreaks: z.number().int().nonnegative(),
    minProgramDurationMs: z.number().nonnegative(),
    tailBufferMs: z.number().nonnegative().default(0),
    // Fixed duration (V1). Used when min/max are not set.
    breakDurationMs: z.number().positive().optional(),
    // Duration range (V2). System picks a random duration in [min, max] per break.
    breakDurationMinMs: z.number().positive().optional(),
    breakDurationMaxMs: z.number().positive().optional(),
    programTypes: z
      .array(
        z.enum(['movie', 'episode', 'track', 'music_video', 'other_video']),
      )
      .optional(),
    // 'eager' = resolve filler at schedule time (V1 behavior)
    // 'lazy'  = emit offline placeholders, resolve at stream time
    strategy: z.enum(['eager', 'lazy']).default('eager'),
  })
  .refine(
    (data) => {
      return data.intervalMs !== undefined || data.breakRule !== undefined;
    },
    { message: 'Either intervalMs or breakRule must be set' },
  )
  .refine(
    (data) => {
      if (
        data.breakDurationMinMs !== undefined ||
        data.breakDurationMaxMs !== undefined
      ) {
        return (
          data.breakDurationMinMs !== undefined &&
          data.breakDurationMaxMs !== undefined &&
          data.breakDurationMaxMs >= data.breakDurationMinMs
        );
      }
      return true;
    },
    {
      message:
        'breakDurationMinMs and breakDurationMaxMs must both be set, and max >= min',
    },
  )
  .refine(
    (data) => {
      return (
        data.breakDurationMs !== undefined ||
        (data.breakDurationMinMs !== undefined &&
          data.breakDurationMaxMs !== undefined)
      );
    },
    {
      message:
        'At least one of breakDurationMs or breakDurationMinMs/breakDurationMaxMs must be set',
    },
  );

export type MidRollConfig = z.infer<typeof MidRollConfigSchema>;

export const Slot = z.object({
  filler: z.array(SlotFiller).optional(),
  midRoll: MidRollConfigSchema.optional(),
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
  seasonExcludeFilter: z.number().array().default([]).catch([]),
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
