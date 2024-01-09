import z from 'zod';
import {
  TvGuideProgramSubtitleSchema,
  ChannelLineupSchema,
  TvGuideProgramSchema,
  EphemeralProgramSchema,
  WorkingProgramSchema,
} from './schemas/index.js';

type Alias<t> = t & { _?: never };

export type TvGuideProgramSubtitle = Alias<
  z.infer<typeof TvGuideProgramSubtitleSchema>
>;

export type TvGuideProgram = Alias<z.infer<typeof TvGuideProgramSchema>>;

export type ChannelLineup = Alias<z.infer<typeof ChannelLineupSchema>>;

export type WorkingProgram = Alias<z.infer<typeof WorkingProgramSchema>>;

export type EphemeralProgram = Alias<z.infer<typeof EphemeralProgramSchema>>;

export function isEphemeralProgram(p: WorkingProgram): p is EphemeralProgram {
  return !p.persisted;
}
