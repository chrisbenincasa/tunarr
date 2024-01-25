import { z } from 'zod';
import {
  ContentProgramSchema,
  CustomProgramSchema,
} from './programmingSchema.js';

export const FillerListProgrammingSchema = z.array(
  z.discriminatedUnion('type', [ContentProgramSchema, CustomProgramSchema]),
);

export const FillerListSchema = z.object({
  id: z.string(),
  name: z.string(),
  contentCount: z.number(),
  programs: FillerListProgrammingSchema.optional(),
});
