import z from 'zod';
import {
  ChannelLineupSchema,
  ContentGuideProgramSchema,
  CustomGuideProgramSchema,
  FlexGuideProgramSchema,
  RedirectGuideProgramSchema,
  TvGuideProgramSchema,
} from './schemas/guideApiSchemas.js';

type Alias<t> = t & { _?: never };

export type ContentGuideProgram = Alias<
  z.infer<typeof ContentGuideProgramSchema>
>;

export type FlexGuideProgram = Alias<z.infer<typeof FlexGuideProgramSchema>>;

export type CustomGuideProgram = Alias<
  z.infer<typeof CustomGuideProgramSchema>
>;

export type RedirectGuideProgram = Alias<
  z.infer<typeof RedirectGuideProgramSchema>
>;

export type TvGuideProgram = Alias<z.infer<typeof TvGuideProgramSchema>>;

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

export type ChannelLineup = Alias<z.infer<typeof ChannelLineupSchema>>;
