import type { z } from 'zod';
import type { StreamSelectionTraceSchema } from './schemas/troubleshootSchemas.js';

export type TroubleshootStreamSelectionTrace = z.infer<
  typeof StreamSelectionTraceSchema
>;
