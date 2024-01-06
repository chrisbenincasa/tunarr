import z from 'zod';
import { ChannelIconSchema } from './channelSchema.js';
import { ProgramTypeSchema } from './programmingSchema.js';
import { PlexEpisodeSchema, PlexMovieSchema } from '../plex/index.js';

export const TvGuideProgramSubtitleSchema = z.object({
  season: z.number().optional(),
  episode: z.number().optional(),
  title: z.string().optional(),
});

export const TvGuideProgramSchema = z.object({
  start: z.number(),
  stop: z.number(),
  summary: z.string().optional(),
  date: z.string().optional(),
  rating: z.string().optional(),
  icon: z.string().optional(),
  title: z.string(),
  sub: TvGuideProgramSubtitleSchema.optional(),
  programDuration: z.number(), //.optional(),
  type: ProgramTypeSchema,
  persisted: z.literal(true),
});

export const ChannelLineupSchema = z.object({
  icon: ChannelIconSchema.optional(),
  name: z.string().optional(),
  number: z.number().optional(),
  programs: z.array(TvGuideProgramSchema),
});

// Represents a program that may or may not have been
// persisted in the database yet. This is typically a program
// that has been added to a Channel in "edit" mode and hasn't
// been saved as part of the Channel's programs, yet.
export const EphemeralProgramSchema = z.object({
  persisted: z.literal(false),
  originalProgram: z.union([PlexEpisodeSchema, PlexMovieSchema]),
  start: z.number(),
  stop: z.number(),
  programDuration: z.number(),
});

export const WorkingProgramSchema = z.discriminatedUnion('persisted', [
  TvGuideProgramSchema,
  EphemeralProgramSchema,
]);
