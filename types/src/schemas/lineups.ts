import z from 'zod/v4';
import {
  DynamicContentConfigSchema,
  LineupScheduleSchema,
} from '../api/Scheduling.js';
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
import { ChannelIconSchema } from './utilSchemas.js';
export * from './lineupPrograms.js';

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

// What a slot save on a rebuilding channel did with each slot's place.
export const ScheduleEditOutcomeSchema = z.discriminatedUnion('placesCarried', [
  z.object({ placesCarried: z.literal(true) }),
  z.object({
    placesCarried: z.literal(false),
    reason: z.enum([
      'no_schedule',
      'no_seed',
      'replay_mismatch',
      'not_started',
    ]),
  }),
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

export const UpdateChannelProgrammingResponseSchema =
  CondensedChannelProgrammingSchema.extend({
    // Set only when the save is a slot schedule that rebuilds each cycle.
    scheduleEdit: ScheduleEditOutcomeSchema.optional(),
  });
