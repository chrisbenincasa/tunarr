// These types are like the DAO Lineup types in Lineup.ts
// but contain a bit more context and are used during an
// active streaming session

import { MediaSourceType } from '@/db/schema/MediaSource.js';
import { ContentProgramTypeSchema } from '@tunarr/types/schemas';
import type { StrictOmit } from 'ts-essentials';
import { z } from 'zod/v4';
import type { EmbyT, JellyfinT } from '../../types/internal.ts';
import type { ProgramType } from '../schema/Program.ts';

const baseStreamLineupItemSchema = z.object({
  streamDuration: z
    .number()
    .nonnegative()
    .optional()
    .describe('The amount of time left in the stream'),
  // beginningOffset: z.number().nonnegative().optional(),
  title: z.string().optional(),
  startOffset: z
    .number()
    .nonnegative()
    .optional()
    .describe('How far into the stream item'),
  programBeginMs: z
    .number()
    .nonnegative()
    .describe('The time the stream item started'),
  duration: z.number().nonnegative().describe('The whole duration of the item'),
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

export function isContentBackedLineupItem(
  item: StreamLineupItem,
): item is ContentBackedStreamLineupItem {
  return isCommercialLineupItem(item) || isProgramLineupItem(item);
}

export function isPlexBackedLineupItem(
  item: StreamLineupItem,
): item is PlexBackedStreamLineupItem {
  return (
    isContentBackedLineupItem(item) &&
    item.externalSource === MediaSourceType.Plex
  );
}

export function isJellyfinBackedLineupItem(
  item: StreamLineupItem,
): item is SpecificSourceContentBackedStreamLineupItem<JellyfinT> {
  return (
    isContentBackedLineupItem(item) &&
    item.externalSource === MediaSourceType.Jellyfin
  );
}

export function isEmnyBackedLineupItem(
  item: StreamLineupItem,
): item is SpecificSourceContentBackedStreamLineupItem<EmbyT> {
  return (
    isContentBackedLineupItem(item) &&
    item.externalSource === MediaSourceType.Emby
  );
}

export type ContentBackedStreamLineupItem =
  | CommercialStreamLineupItem
  | ProgramStreamLineupItem;

export type MinimalContentStreamLineupItem = {
  programId: string;
  programType: ProgramType;
  externalKey: string;
  externalSourceId: string;
  externalSource: MediaSourceType;
  duration: number;
  externalFilePath: string | undefined;
};

export type SpecificSourceContentBackedStreamLineupItem<
  Typ extends MediaSourceType,
> = StrictOmit<ContentBackedStreamLineupItem, 'externalSource'> & {
  externalSource: Typ;
};

export type PlexBackedStreamLineupItem =
  SpecificSourceContentBackedStreamLineupItem<typeof MediaSourceType.Plex>;

export type SpecificMinimalContentStreamLineupItem<
  Typ extends MediaSourceType,
> = StrictOmit<MinimalContentStreamLineupItem, 'externalSource'> & {
  externalSource: Typ;
};

export type MinimalPlexBackedStreamLineupItem =
  SpecificMinimalContentStreamLineupItem<typeof MediaSourceType.Plex>;

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
    // ID in the program DB table
    programId: z.string().uuid(),
    // These are taken from the Program DB entity
    plexFilePath: z.string().optional(),
    externalSourceId: z.string(),
    filePath: z.string().optional(),
    externalKey: z.string(),
    programType: ContentProgramTypeSchema,
    externalSource: z.nativeEnum(MediaSourceType),
  });

const CommercialStreamLineupItemSchema =
  BaseContentBackedStreamLineupItemSchema.extend({
    type: z.literal('commercial'),
    fillerId: z.string(),
  }).required({ streamDuration: true });

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

export function createOfflineStreamLineupItem(
  duration: number,
  programBeginMs: number,
): OfflineStreamLineupItem {
  return {
    duration,
    startOffset: 0,
    type: 'offline',
    programBeginMs,
  };
}
