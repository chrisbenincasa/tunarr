import { z } from 'zod';
import { TupleToUnion } from '../util.js';
import { constructZodLiteralUnionType } from './util.js';

// Should match the DB schema...
export const ExternalIdType = [
  'plex',
  'plex-guid',
  'imdb',
  'tmdb',
  'tvdb',
  'jellyfin',
] as const;

export type ExternalIdType = TupleToUnion<typeof ExternalIdType>;

export const SingleExternalIdType = [
  'plex-guid',
  'imdb',
  'tmdb',
  'tvdb',
] as const;

export type SingleExternalIdType = TupleToUnion<typeof SingleExternalIdType>;

export const SingleExternalIdSourceSchema = constructZodLiteralUnionType(
  SingleExternalIdType.map((typ) => z.literal(typ)),
);

export const MultiExternalIdType = ['plex', 'jellyfin'] as const;
export type MultiExternalIdType = TupleToUnion<typeof MultiExternalIdType>;

function inConstArr<Arr extends readonly string[], S extends string>(
  arr: Arr,
  typ: S,
): boolean {
  for (const value of arr) {
    if (value === typ) {
      return true;
    }
  }

  return false;
}

export function isValidSingleExternalIdType(
  s: string,
): s is SingleExternalIdType {
  return inConstArr(SingleExternalIdType, s);
}

export function isValidMultiExternalIdType(
  s: string,
): s is MultiExternalIdType {
  return inConstArr(MultiExternalIdType, s);
}

// Represents an external ID that has a single
// source-of-truth (i.e. the 'id' field is global)
// to the source, e.g. IMDB
export const SingleExternalIdSchema = z.object({
  type: z.literal('single'),
  source: SingleExternalIdSourceSchema,
  id: z.string(),
});

// When we have more sources, this will be a union
export const MultiExternalSourceSchema = z.union([
  z.literal('plex'),
  z.literal('jellyfin'),
]);

// Represents components of an ID that can be
// used to address an object (program or grouping) in
// an external source  e.g. Plex. This differs from
// a SingleExternalId in that there is not a 'single'
// source; we include the sourceId to know which
// 'source' to address, e.g. Plex server ID
export const MultiExternalIdSchema = z.object({
  type: z.literal('multi'),
  // The source type of the ID
  source: MultiExternalSourceSchema,
  sourceId: z.string(),
  id: z.string(),
});

// ExternalIds are either global or multi IDs.
export const ExternalIdSchema = z.discriminatedUnion('type', [
  SingleExternalIdSchema,
  MultiExternalIdSchema,
]);

export const ChannelIconSchema = z.object({
  path: z.string().catch(''),
  width: z.number().nonnegative().catch(0),
  duration: z.number().catch(0),
  position: z
    .union([
      z.literal('top-left'),
      z.literal('top-right'),
      z.literal('bottom-left'),
      z.literal('bottom-right'),
    ])
    .catch('bottom-right'),
});

export const TimeUnitSchema = z.union([
  z.literal('second'),
  z.literal('minute'),
  z.literal('hour'),
  z.literal('day'),
  z.literal('week'),
]);

export const CronScheduleSchema = z.object({
  type: z.literal('cron'),
  cron: z.string(),
});

export const EveryScheduleSchema = z.object({
  type: z.literal('every'),
  increment: z.number().positive(),
  unit: TimeUnitSchema,
  offsetMs: z
    .number()
    .min(0)
    .max(1000 * 60 * 60 * 24 - 1)
    .default(0),
});

export type EverySchedule = z.infer<typeof EveryScheduleSchema>;

export const ScheduleSchema = z.discriminatedUnion('type', [
  CronScheduleSchema,
  EveryScheduleSchema,
]);
