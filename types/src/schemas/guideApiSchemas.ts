import z from 'zod';
import { ChannelIconSchema } from './index.js';
import {
  ContentProgramSchema,
  CustomProgramSchema,
  FlexProgramSchema,
  RedirectProgramSchema,
} from './programmingSchema.js';

// Guide programs are just like regular programs, but they have a start
// and and end time
const BaseGuideProgramSchema = z.object({
  start: z.number(),
  stop: z.number(),
});

export const ContentGuideProgramSchema = ContentProgramSchema.merge(
  BaseGuideProgramSchema,
);
export const CustomGuideProgramSchema = CustomProgramSchema.merge(
  BaseGuideProgramSchema,
);
export const RedirectGuideProgramSchema = RedirectProgramSchema.merge(
  BaseGuideProgramSchema,
);
export const FlexGuideProgramSchema = FlexProgramSchema.merge(
  BaseGuideProgramSchema,
);

export const TvGuideProgramSchema = z.discriminatedUnion('type', [
  ContentGuideProgramSchema,
  CustomGuideProgramSchema,
  RedirectGuideProgramSchema,
  FlexGuideProgramSchema,
]);

export const ChannelLineupSchema = z.object({
  icon: ChannelIconSchema.optional(),
  name: z.string().optional(),
  number: z.number().optional(),
  programs: z.array(TvGuideProgramSchema),
});
