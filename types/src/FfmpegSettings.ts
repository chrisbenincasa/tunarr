import type z from 'zod/v4';
import { FfmpegSettingsSchema } from './schemas/settingsSchemas.js';

export type FfmpegSettings = z.infer<typeof FfmpegSettingsSchema>;
export const defaultFfmpegSettings = FfmpegSettingsSchema.parse({});
