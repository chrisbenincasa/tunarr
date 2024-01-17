import z from 'zod';
import { HdhrSettingsSchema } from './schemas/settingsSchemas.js';

export type HdhrSettings = z.infer<typeof HdhrSettingsSchema>;
