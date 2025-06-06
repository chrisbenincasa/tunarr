import { z } from 'zod/v4';

export const ThemeSchema = z.object({
  darkMode: z.boolean().optional(),
  pathway: z.string().default(''),
});
