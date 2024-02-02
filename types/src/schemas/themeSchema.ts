import { z } from 'zod';

export const ThemeSchema = z.object({
  darkMode: z.boolean().optional(),
  pathway: z.string().default(''),
});
