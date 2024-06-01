// These types are like the DAO Lineup types in Lineup.ts
// but contain a bit more context and are used during an
// active streaming session

import { z } from 'zod';

const baseStreamLineupItemSchema = z.object({
  originalTimestamp: z.number().nonnegative().optional(),
  streamDuration: z.number().nonnegative().optional(),
  beginningOffset: z.number().nonnegative().optional(),
  title: z.string().optional(),
  start: z.number().nonnegative().optional(),
  duration: z.number().nonnegative(),
});

export function isOfflineLineupItem(
  item: StreamLineupItem,
): item is OfflineStreamLineupItem | RedirectStreamLineupItem {
  return item.type === 'offline' || item.type === 'redirect';
}

export function isCommercialLineupItem(
  item: StreamLineupItem,
): item is CommercialStreamLineupItem {
  return item.type === 'commercial';
}

export function isProgramLineupItem(
  item: StreamLineupItem,
): item is ProgramStreamLineupItem {
  return item.type === 'program';
}

export function isContentBackedLineupIteam(
  item: StreamLineupItem,
): item is ContentBackedStreamLineupItem {
  return isCommercialLineupItem(item) || isProgramLineupItem(item);
}

export type ContentBackedStreamLineupItem =
  | CommercialStreamLineupItem
  | ProgramStreamLineupItem;

export const OfflineStreamLineupItemSchema = baseStreamLineupItemSchema.extend({
  type: z.literal('offline'),
});

export type OfflineStreamLineupItem = z.infer<
  typeof OfflineStreamLineupItemSchema
>;

export const LoadingStreamLineupItemSchema = baseStreamLineupItemSchema
  .extend({
    type: z.literal('loading'),
  })
  .required({ streamDuration: true });

export type LoadingStreamLineupItem = z.infer<
  typeof LoadingStreamLineupItemSchema
>;

const ProgramTypeEnum = z.enum(['movie', 'episode', 'track']);

const BaseContentBackedStreamLineupItemSchema =
  baseStreamLineupItemSchema.extend({
    programId: z.string().uuid(),
    // These are taken from the Program DB entity
    plexFilePath: z.string().optional(),
    externalSourceId: z.string(),
    filePath: z.string().optional(),
    externalKey: z.string(),
    programType: ProgramTypeEnum,
  });

const CommercialStreamLineupItemSchema =
  BaseContentBackedStreamLineupItemSchema.extend({
    type: z.literal('commercial'),
  }).required({ streamDuration: true, beginningOffset: true });

export type CommercialStreamLineupItem = z.infer<
  typeof CommercialStreamLineupItemSchema
>;

const ProgramStreamLineupItemSchema =
  BaseContentBackedStreamLineupItemSchema.extend({
    type: z.literal('program'),
    id: z.string().uuid(),
  }).required({ title: true });

export type ProgramStreamLineupItem = z.infer<
  typeof ProgramStreamLineupItemSchema
>;

export const RedirectStreamLineupItemSchema = baseStreamLineupItemSchema.extend(
  {
    type: z.literal('redirect'),
    channel: z.string().uuid(),
    duration: z.number().positive(),
  },
);

export const ErrorStreamLineupItemSchema = baseStreamLineupItemSchema.extend({
  type: z.literal('error'),
  error: z.instanceof(Error).or(z.string()).or(z.boolean()),
});

export type RedirectStreamLineupItem = z.infer<
  typeof RedirectStreamLineupItemSchema
>;

export const StreamLineupItemSchema = z.discriminatedUnion('type', [
  ProgramStreamLineupItemSchema,
  CommercialStreamLineupItemSchema,
  LoadingStreamLineupItemSchema,
  OfflineStreamLineupItemSchema,
  RedirectStreamLineupItemSchema,
  ErrorStreamLineupItemSchema,
]);

export type StreamLineupItem = z.infer<typeof StreamLineupItemSchema>;

// Subset of StreamLineupItem that only includes valid lineup.json item
// types with additional details + error type.
// This is still a little messy because we have a lot of very similar
// versions of the same type flying around -- a remnant of the untyped
// nature of the original DTV -- this can slowly be unraveled and/or
// consolidated as we rewrite pieces of the streaming pipeline.
export const EnrichedLineupItemSchema = z.discriminatedUnion('type', [
  ProgramStreamLineupItemSchema,
  OfflineStreamLineupItemSchema,
  RedirectStreamLineupItemSchema,
  ErrorStreamLineupItemSchema,
]);

export type EnrichedLineupItem = z.infer<typeof EnrichedLineupItemSchema>;

export function createOfflineStreamLineupIteam(
  duration: number,
): OfflineStreamLineupItem {
  return {
    duration,
    start: 0,
    type: 'offline',
  };
}
