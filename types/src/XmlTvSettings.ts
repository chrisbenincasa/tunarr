import type z from 'zod/v4';
import { XmlTvSettingsSchema } from './schemas/settingsSchemas.js';

export type XmlTvSettings = z.infer<typeof XmlTvSettingsSchema>;

export const defaultXmlTvSettings = XmlTvSettingsSchema.parse({});
