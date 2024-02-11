import { z } from 'zod';
import {
  ChannelProgramSchema,
  ContentProgramSchema,
  CustomProgramSchema,
} from '../schemas/programmingSchema.js';
import { TimeSlotScheduleSchema } from './Scheduling.js';

export * from './Scheduling.js';

type Alias<T> = T & { _?: never };

export const IdPathParamSchema = z.object({
  id: z.string(),
});

export const ChannelNumberParamSchema = z.object({
  number: z.coerce.number(),
});

export const ChannelLineupQuery = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  includePrograms: z.coerce.boolean().default(false),
});

export const LookupExternalProgrammingSchema = z.object({
  externalId: z
    .string()
    .transform((s) => s.split('|', 3) as [string, string, string]),
});

export const BatchLookupExternalProgrammingSchema = z.object({
  externalIds: z.array(z.string()),
});

export const CreateCustomShowRequestSchema = z.object({
  name: z.string(),
  programs: z.array(
    z.discriminatedUnion('type', [ContentProgramSchema, CustomProgramSchema]),
  ),
});

export type CreateCustomShowRequest = Alias<
  z.infer<typeof CreateCustomShowRequestSchema>
>;

export const CreateFillerListRequestSchema = z.object({
  name: z.string(),
  programs: z.array(
    z.discriminatedUnion('type', [ContentProgramSchema, CustomProgramSchema]),
  ),
});

export type CreateFillerListRequest = Alias<
  z.infer<typeof CreateFillerListRequestSchema>
>;

export const BasicIdParamSchema = z.object({
  id: z.string(),
});

export const BasicPagingSchema = z.object({
  offset: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
});

const UpdateLineupItemSchema = z.object({
  index: z.number(),
  duration: z.number().optional(), // Duration for non-content programs
});

export const ManualProgramLineupSchema = z.object({
  type: z.literal('manual'),
  programs: z.array(ChannelProgramSchema),
  lineup: z.array(UpdateLineupItemSchema), // Array of indexes into the programming array
});

export const TimeBasedProgramLineupSchema = z.object({
  type: z.literal('time'),
  // This must be the list of programs BEFORE any scheduling
  // We do this so that we can potentially create longer schedules
  // on the server-side. However, we can filter this list down to only
  // programs included in at least one time slot...
  programs: z.array(ChannelProgramSchema),
  schedule: TimeSlotScheduleSchema,
});

export const UpdateChannelProgrammingRequestSchema = z.discriminatedUnion(
  'type',
  [ManualProgramLineupSchema, TimeBasedProgramLineupSchema],
);

export type UpdateChannelProgrammingRequest = Alias<
  z.infer<typeof UpdateChannelProgrammingRequestSchema>
>;
