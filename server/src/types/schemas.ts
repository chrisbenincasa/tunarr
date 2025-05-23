import { z } from 'zod/v4';

export const TruthyQueryParam = z
  .union([
    z.boolean(),
    z.literal('true'),
    z.literal('false'),
    z.coerce.number(),
  ])
  .transform((value) => value === 1 || value === true || value === 'true');
