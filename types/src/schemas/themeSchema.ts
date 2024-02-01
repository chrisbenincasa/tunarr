import { z } from 'zod';

export const ThemeSchema = z.object({
  darkMode: z.boolean().default(false),
  pathway: z.string().default(''),
});
