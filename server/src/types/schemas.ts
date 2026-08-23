import { every, isArray, isUndefined } from 'lodash-es';
import z from 'zod/v4';
import { programSourceTypeFromString } from '../db/custom_types/ProgramSourceType.ts';
import type { Nilable } from './util.ts';

export const TruthyQueryParam = z
  .union([
    z.boolean(),
    z.literal('true'),
    z.literal('false'),
    z.coerce.number(),
  ])
  .transform((value) => value === 1 || value === true || value === 'true');

/**
 * `.default()` only fires for a *missing* key, so a present-but-empty
 * `?limit=` never reached it: `z.coerce.number()` turned "" into 0, which
 * passes `.min(-1)` and reaches the DB as `.limit(0)` — while the sentinel for
 * "no limit" is -1. A client building its query as `limit=${value ?? ''}` got
 * a 200 and an empty page. Map blank to undefined first so the default applies.
 */
const blankAsAbsent = <T extends z.ZodType>(schema: T) =>
  z.preprocess(
    (value) =>
      typeof value === 'string' && value.trim() === '' ? undefined : value,
    schema,
  );

export const PagingParams = z.object({
  // `.int()` because there was none, so `?limit=1.5` reached SQL as a float.
  limit: blankAsAbsent(z.coerce.number().int().min(-1).default(-1)),
  offset: blankAsAbsent(z.coerce.number().int().nonnegative().default(0)),
});

export const jsonSchema = z.json();
export type Json = z.infer<typeof jsonSchema>;

export type JsonObject = {
  [key: string]: Json;
};

export function isJsonObject(t: Nilable<Json>): t is JsonObject {
  return !(
    (typeof t !== 'object' && typeof t !== 'function') ||
    t === null ||
    isArray(t)
  );
}
export const mediaSourceParamsSchema = z.object({
  mediaSourceId: z.string(),
});
export const BatchLookupExternalProgrammingSchema = z.object({
  externalIds: z
    .array(z.string())
    .transform(
      (s) =>
        new Set(
          [...s].map((s0) => s0.split('|', 3) as [string, string, string]),
        ),
    )
    .refine((set) => {
      return every(
        [...set],
        (tuple) => !isUndefined(programSourceTypeFromString(tuple[0])),
      );
    }),
});
