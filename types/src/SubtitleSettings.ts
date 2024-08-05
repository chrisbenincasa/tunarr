import { z } from 'zod';
import { SubtitleConfigurationSchema } from './schemas/settingsSchemas.js';

export type SubtitleSettings = z.infer<typeof SubtitleConfigurationSchema>;

export const defaultSubtitleSettings = SubtitleConfigurationSchema.parse({});
