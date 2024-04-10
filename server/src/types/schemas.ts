import { z } from 'zod';
export const TruthyQueryParam = z
  .string()
  .transform((s) => s === 'true' || s === '1');
