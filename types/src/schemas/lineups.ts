import z from 'zod/v4';
import {
  DynamicContentConfigSchema,
  LineupScheduleSchema,
} from '../api/Scheduling.js';
import { ChannelIconSchema } from './utilSchemas.js';
export * from './lineupPrograms.js';
import {
  CondensedContentProgramSchema,
  CondensedCustomProgramSchema,
  CondensedFillerProgramSchema,
  ContentProgramSchema,
  CustomProgramSchema,
  FillerProgramSchema,
  FlexProgramSchema,
  RedirectProgramSchema,
} from './lineupPrograms.js';

export const ChannelProgramSchema = z.discriminatedUnion('type', [
  ContentProgramSchema,
  CustomProgramSchema,
  RedirectProgramSchema,
  FlexProgramSchema,
  FillerProgramSchema,
]);

export const ChannelProgrammingSchema = z.object({
  icon: ChannelIconSchema.optional(),
  name: z.string().optional(),
  number: z.number().optional(),
  totalPrograms: z.number(),
  programs: z.array(ChannelProgramSchema),
  startTimeOffsets: z.array(z.number()),
});

export const CondensedChannelProgramSchema = z.discriminatedUnion('type', [
  CondensedContentProgramSchema,
  CondensedCustomProgramSchema,
  CondensedFillerProgramSchema,
  RedirectProgramSchema,
  FlexProgramSchema,
]);

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
