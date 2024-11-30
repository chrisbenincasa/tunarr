import { z } from 'zod';
import { TranscodeConfigSchema } from './schemas/transcodeConfigSchemas.js';

export type TranscodeConfig = z.infer<typeof TranscodeConfigSchema>;
