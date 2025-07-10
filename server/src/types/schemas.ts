import { z } from 'zod/v4';

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
