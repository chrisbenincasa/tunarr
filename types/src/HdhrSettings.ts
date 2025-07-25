import type z from 'zod/v4';
import { HdhrSettingsSchema } from './schemas/settingsSchemas.js';

export type HdhrSettings = z.infer<typeof HdhrSettingsSchema>;

export const defaultHdhrSettings = HdhrSettingsSchema.parse({});
