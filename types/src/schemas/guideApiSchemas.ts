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

// Flex programs in guide can have a title
export const FlexGuideProgramSchema = FlexProgramSchema.merge(
  BaseGuideProgramSchema,
).extend({
  title: z.string(),
});

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
  id: z.string().optional(),
  programs: z.array(TvGuideProgramSchema),
});
