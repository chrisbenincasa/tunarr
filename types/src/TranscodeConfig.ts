import type { z } from 'zod';
import type {
  SupportedTranscodeVideoOutputFormats,
  TranscodeConfigSchema,
} from './schemas/transcodeConfigSchemas.js';
import type { TupleToUnion } from './util.js';

export type SupportedTranscodeVideoOutputFormat = TupleToUnion<
  typeof SupportedTranscodeVideoOutputFormats
>;

export type TranscodeConfig = z.infer<typeof TranscodeConfigSchema>;
