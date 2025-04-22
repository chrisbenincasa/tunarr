import { z } from 'zod';

export const SubtitleFilterSchema = z.enum([
  'none',
  'forced',
  'default',
  'any',
]);

export const SubtitlePreference = z.object({
  langugeCode: z.string(),
  priority: z.number().nonnegative(),
  allowImageBased: z.boolean(),
  allowExternal: z.boolean(),
  filter: SubtitleFilterSchema.default('any'),
});
