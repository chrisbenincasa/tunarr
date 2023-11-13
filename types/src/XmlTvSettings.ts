import z from 'zod';
import { XmlTvSettingsSchema } from './schemas/settingsSchemas.js';

export type XmlTvSettings = z.infer<typeof XmlTvSettingsSchema>;
