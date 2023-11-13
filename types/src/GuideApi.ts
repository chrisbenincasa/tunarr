import z from 'zod';
import {
  TvGuideProgramSubtitleSchema,
  ChannelLineupSchema,
  TvGuideProgramSchema,
} from './schemas/index.js';

export type TvGuideProgramSubtitle = z.infer<
  typeof TvGuideProgramSubtitleSchema
>;
export type TvGuideProgram = z.infer<typeof TvGuideProgramSchema>;
export type ChannelLineup = z.infer<typeof ChannelLineupSchema>;
