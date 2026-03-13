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

export const PagingParams = z.object({
  limit: z.coerce.number().min(-1).default(-1),
  offset: z.coerce.number().nonnegative().default(0),
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
