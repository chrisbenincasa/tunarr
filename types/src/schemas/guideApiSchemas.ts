import z from 'zod';
import { ChannelIconSchema } from './channelSchema.js';

export const TvGuideProgramSubtitleSchema = z.object({
  season: z.number().optional(),
  episode: z.number().optional(),
  title: z.string().optional(),
});

export const TvGuideProgramSchema = z.object({
  start: z.string(),
  stop: z.string(),
  summary: z.string().optional(),
  date: z.string().optional(),
  rating: z.string().optional(),
  icon: z.string().optional(),
  title: z.string(),
  sub: TvGuideProgramSubtitleSchema.optional(),
  programDuration: z.number().optional(),
});

export const ChannelLineupSchema = z.object({
  icon: ChannelIconSchema.optional(),
  name: z.string().optional(),
  number: z.number().optional(),
  programs: z.array(TvGuideProgramSchema),
});
