import type z from 'zod/v4';
import { ThemeSchema } from './schemas/themeSchema.js';

export const defaultTheme = ThemeSchema.parse({});
export type Theme = z.infer<typeof ThemeSchema>;
