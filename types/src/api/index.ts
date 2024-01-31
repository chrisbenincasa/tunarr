import { z } from 'zod';
import {
  ContentProgramSchema,
  CustomProgramSchema,
} from '../schemas/programmingSchema.js';

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

export * from './Scheduling.js';
