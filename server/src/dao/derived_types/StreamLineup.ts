// These types are like the DAO Lineup types in Lineup.ts
// but contain a bit more context and are used during an
// active streaming session

import { z } from 'zod';

const baseStreamLineupItemSchema = z.object({
  error: z.boolean().or(z.string()).optional(),
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

const BaseContentBackedStreamLineupItemSchema =
  baseStreamLineupItemSchema.extend({
    programId: z.string().uuid(),
    // These are taken from the Program DB entity
    plexFilePath: z.string(),
    externalSourceId: z.string(),
    filePath: z.string(),
    externalKey: z.string(),
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

export type RedirectStreamLineupItem = z.infer<
  typeof RedirectStreamLineupItemSchema
>;

export const StreamLineupItemSchema = z.discriminatedUnion('type', [
  ProgramStreamLineupItemSchema,
  CommercialStreamLineupItemSchema,
  LoadingStreamLineupItemSchema,
  OfflineStreamLineupItemSchema,
  RedirectStreamLineupItemSchema,
]);

export type StreamLineupItem = z.infer<typeof StreamLineupItemSchema>;

export function createOfflineStreamLineupIteam(
  duration: number,
): OfflineStreamLineupItem {
  return {
    duration,
    start: 0,
    type: 'offline',
  };
}
