import { z } from 'zod/v4';
import { type TupleToUnion } from '../util.js';
import { constructZodLiteralUnionType } from './util.js';

// Should match the DB schema...
export const ExternalIdType = [
  'plex',
  'plex-guid',
  'imdb',
  'tmdb',
  'tvdb',
  'jellyfin',
  'emby',
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

export const MultiExternalIdType = ['plex', 'jellyfin', 'emby'] as const;
export const MultiExternalSourceSchema = z.enum(MultiExternalIdType);
export type MultiExternalIdType = z.infer<typeof MultiExternalSourceSchema>;

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

export const ExternalIdSourceType = z.enum(ExternalIdType);

// Represents an external ID that has a single
// source-of-truth (i.e. the 'id' field is global)
// to the source, e.g. IMDB
export const SingleExternalIdSchema = z.object({
  type: z.literal('single'),
  source: SingleExternalIdSourceSchema,
  id: z.string(),
});

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
  useDefaultIconFallback: z.boolean().optional().catch(true),
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
export const ContentProgramTypeSchema = z.enum([
  'movie',
  'episode',
  'track',
  'music_video',
  'other_video',
]);

export type Schedule = z.infer<typeof ScheduleSchema>;

/**
 * A boolean carried in a query string.
 *
 * Not `z.coerce.boolean()`, which is `Boolean(value)` and so returns true for
 * every non-empty string — including "false" and "0". A parameter declared that
 * way cannot be turned off: `?flag=false` reads as true, silently, with no
 * validation error to indicate it. Nor is it `.or(z.stringbool())` as a
 * fallback, because `z.coerce.boolean()` never fails, so a following union
 * branch is unreachable.
 *
 * Accepts "true"/"false" and any number, where 0 is false. An absent value
 * ("?flag" with no "=") arrives as the empty string and coerces to 0, so it is
 * false; declare `.default(true)` if a bare flag should mean something else.
 *
 * The number test is `!== 0` rather than `=== 1`. Comparing against 1 would
 * accept any numeric through the coercion branch and then quietly read every
 * value but 1 as false, so `?background=2` would run in the background — the
 * same silent-false failure this schema exists to prevent.
 */
export const TruthyQueryParam = z
  .union([
    z.boolean(),
    z.literal('true'),
    z.literal('false'),
    z.coerce.number(),
  ])
  .transform(
    (value) =>
      value === true ||
      value === 'true' ||
      (typeof value === 'number' && value !== 0),
  );
