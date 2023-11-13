import { FfmpegSettingsSchema } from './schemas/settingsSchemas.js';
import z from 'zod';

export type FfmpegSettings = z.infer<typeof FfmpegSettingsSchema>;

export const defaultFfmpegSettings = FfmpegSettingsSchema.parse({});
