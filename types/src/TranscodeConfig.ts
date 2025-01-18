import { z } from 'zod';
import {
  SupportedTranscodeVideoOutputFormats,
  TranscodeConfigSchema,
} from './schemas/transcodeConfigSchemas.js';
import { TupleToUnion } from './util.js';

export type SupportedTranscodeVideoOutputFormat = TupleToUnion<
  typeof SupportedTranscodeVideoOutputFormats
>;

export type TranscodeConfig = z.infer<typeof TranscodeConfigSchema>;
