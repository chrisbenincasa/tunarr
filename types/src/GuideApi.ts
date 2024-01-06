import z from 'zod';
import {
  TvGuideProgramSubtitleSchema,
  ChannelLineupSchema,
  TvGuideProgramSchema,
  EphemeralProgramSchema,
} from './schemas/index.js';

type Alias<t> = t & { _?: never };

export type TvGuideProgramSubtitle = Alias<
  z.infer<typeof TvGuideProgramSubtitleSchema>
>;

export type TvGuideProgram = Alias<z.infer<typeof TvGuideProgramSchema>>;

export type ChannelLineup = Alias<z.infer<typeof ChannelLineupSchema>>;

export type EphemeralProgram = Alias<z.infer<typeof EphemeralProgramSchema>>;
