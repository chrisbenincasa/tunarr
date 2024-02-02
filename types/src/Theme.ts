import { ThemeSchema } from './schemas/themeSchema.js';
import z from 'zod';

export const defaultTheme = ThemeSchema.parse({});
export type Theme = z.infer<typeof ThemeSchema>;
