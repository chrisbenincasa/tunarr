import { z } from 'zod/v4';
import { ContentProgramSchema, CustomProgramSchema } from './lineupPrograms.js';

export const FillerListProgrammingSchema = z.array(
  z.discriminatedUnion('type', [ContentProgramSchema, CustomProgramSchema]),
);

export const FillerListSchema = z.object({
  id: z.string(),
  name: z.string(),
  contentCount: z.number(),
  programs: FillerListProgrammingSchema.optional(),
  // Applies when a program plays as filler from this list.
  streamSelectionProfileId: z.uuid().nullish(),
});
