import z from 'zod/v4';
import {
  DynamicContentConfigSchema,
  LineupScheduleSchema,
} from '../api/Scheduling.js';
import {
  CondensedChannelProgramSchema,
  ContentProgramSchema,
} from './programmingSchema.js';
import { ChannelIconSchema } from './utilSchemas.js';

export const CondensedChannelProgrammingSchema = z.object({
  icon: ChannelIconSchema.optional(),
  name: z.string().optional(),
  number: z.number().optional(),
  totalPrograms: z.number(),
  programs: z.record(z.string(), ContentProgramSchema),
  lineup: z.array(CondensedChannelProgramSchema),
  startTimeOffsets: z.array(z.number()),
  schedule: LineupScheduleSchema.optional(),
  dynamicContentConfig: DynamicContentConfigSchema.optional(),
});
