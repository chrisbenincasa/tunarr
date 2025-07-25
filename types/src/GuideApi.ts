import type z from 'zod/v4';
import type {
  ChannelLineupSchema,
  ContentGuideProgramSchema,
  CustomGuideProgramSchema,
  FlexGuideProgramSchema,
  RedirectGuideProgramSchema,
  TvGuideProgramSchema,
} from './schemas/guideApiSchemas.js';

export type ContentGuideProgram = z.infer<typeof ContentGuideProgramSchema>;

export type FlexGuideProgram = z.infer<typeof FlexGuideProgramSchema>;

export type CustomGuideProgram = z.infer<typeof CustomGuideProgramSchema>;

export type RedirectGuideProgram = z.infer<typeof RedirectGuideProgramSchema>;

export type TvGuideProgram = z.infer<typeof TvGuideProgramSchema>;

function isGuideProgramType<T extends TvGuideProgram>(
  types: ReadonlyArray<T['type']>,
) {
  return (p: TvGuideProgram): p is T => {
    return types.includes(p.type);
  };
}

export const isContentGuideProgram = isGuideProgramType<ContentGuideProgram>([
  'content',
]);

export const isFlexGuideProgram = isGuideProgramType<FlexGuideProgram>([
  'flex',
]);

export type ChannelLineup = z.infer<typeof ChannelLineupSchema>;
