import { z } from 'zod/v4';
import {
  ContentProgramSchema,
  CustomProgramSchema,
} from './programmingSchema.js';

export const CustomShowProgrammingSchema = z.array(
  z.discriminatedUnion('type', [ContentProgramSchema, CustomProgramSchema]),
);

export const CustomShowSchema = z.object({
  id: z.string(),
  name: z.string(),
  contentCount: z.number(),
  programs: z.array(CustomProgramSchema).optional(),
  totalDuration: z.number().nonnegative(),
});
