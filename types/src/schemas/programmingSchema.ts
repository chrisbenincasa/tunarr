import z from 'zod';
import { PlexEpisodeSchema, PlexMovieSchema } from '../plex/index.js';
import { ChannelIconSchema } from './utilSchemas.js';

export const ProgramTypeSchema = z.union([
  z.literal('movie'),
  z.literal('episode'),
  z.literal('track'),
  z.literal('redirect'),
  z.literal('custom'),
  z.literal('flex'),
]);

export const ProgramSchema = z.object({
  channel: z.number().optional(), // Redirect
  customOrder: z.number().optional(),
  customShowId: z.string().optional(),
  customShowName: z.string().optional(),
  date: z.string().optional(),
  duration: z.number(),
  episode: z.number().optional(),
  episodeIcon: z.string().optional(),
  file: z.string().optional(),
  id: z.string(),
  icon: z.string().optional(),
  isOffline: z.boolean(), // Flex
  key: z.string().optional(),
  plexFile: z.string().optional(), // Not present on offline type
  rating: z.string().optional(),
  ratingKey: z.string().optional(), // Not present on offline type
  season: z.number().optional(),
  seasonIcon: z.string().optional(),
  serverKey: z.string().optional(),
  showIcon: z.string().optional(),
  showTitle: z.string().optional(), // Unclear if this is necessary
  summary: z.string().optional(), // Not present on offline type
  title: z.string().optional(),
  type: ProgramTypeSchema,
  year: z.number().optional(),
});

export const ExternalSourceTypeSchema = z.enum(['plex']);

// The following schemas make up a channel's programming
// They are "timeless" in the sense that they do not encode a
// start and end time (like the guide/lineup). A listing of
// these programs makes up one channel "cycle".
const BaseProgramSchema = z.object({
  persisted: z.boolean(),
  duration: z.number(),
  icon: z.string().optional(),
});

export const FlexProgramSchema = BaseProgramSchema.extend({
  type: z.literal('flex'),
});

export const RedirectProgramSchema = BaseProgramSchema.extend({
  type: z.literal('redirect'),
  channel: z.number(),
});

export const ContentProgramSchema = BaseProgramSchema.extend({
  type: z.literal('content'),
  subtype: z.union([
    z.literal('movie'),
    z.literal('episode'),
    z.literal('track'),
  ]),
  id: z.string().optional(), // If persisted
  // Meta
  summary: z.string().optional(),
  date: z.string().optional(),
  rating: z.string().optional(),
  title: z.string(), // If an episode, this is the show title
  episodeTitle: z.string().optional(),
  seasonNumber: z.number().optional(),
  episodeNumber: z.number().optional(),
  // TODO: Include track
  originalProgram: z
    .discriminatedUnion('type', [PlexEpisodeSchema, PlexMovieSchema])
    .optional(),
  externalSourceType: ExternalSourceTypeSchema.optional(),
  externalSourceName: z.string().optional(),
});
// Should be able to do this once we have https://github.com/colinhacks/zod/issues/2106
// .refine(
//   (val) =>
//     (!val.externalSourceName && !val.externalSourceType) ||
//     (val.externalSourceName && val.externalSourceType),
//   {
//     message:
//       'Must define neither externalSourceName / externalSourceType, or both.',
//   },
// );

export const CustomProgramSchema = BaseProgramSchema.extend({
  type: z.literal('custom'),
  id: z.string(),
  program: ContentProgramSchema.optional(),
});

export const ChannelProgramSchema = z.discriminatedUnion('type', [
  ContentProgramSchema,
  CustomProgramSchema,
  RedirectProgramSchema,
  FlexProgramSchema,
]);

export const ChannelProgrammingSchema = z.object({
  icon: ChannelIconSchema.optional(),
  name: z.string().optional(),
  number: z.number().optional(),
  programs: z.array(ChannelProgramSchema),
});
