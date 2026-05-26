import z from 'zod/v4';
import {
  ChannelIconSchema,
  ContentProgramSchema,
  CustomProgramSchema,
  FlexProgramSchema,
  RedirectProgramSchema,
} from './index.js';

// Guide programs are just like regular programs, but they have a start
// and and end time
const BaseGuideProgramSchema = z.object({
  start: z.number(),
  stop: z.number(),
  isPaused: z.boolean().optional().default(false),
  timeRemaining: z.number().optional(),
});

export const ContentGuideProgramSchema = ContentProgramSchema.required({
  id: true,
}).extend(BaseGuideProgramSchema.shape);

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
  name: z.string(),
  number: z.number(),
  id: z.uuid(),
  programs: z.array(TvGuideProgramSchema),
});
