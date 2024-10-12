import z from 'zod';
import {
  DynamicContentConfigSchema,
  LineupScheduleSchema,
} from '../api/Scheduling.js';
import { JellyfinItem } from '../jellyfin/index.js';
import {
  PlexEpisodeSchema,
  PlexMovieSchema,
  PlexMusicTrackSchema,
} from '../plex/index.js';
import { ChannelIconSchema, ExternalIdSchema } from './utilSchemas.js';

export const ProgramTypeSchema = z.union([
  z.literal('movie'),
  z.literal('episode'),
  z.literal('track'),
  z.literal('redirect'),
  z.literal('custom'),
  z.literal('flex'),
]);

export const ExternalSourceTypeSchema = z.union([
  z.literal('plex'),
  z.literal('jellyfin'),
]);

export const ProgramSchema = z.object({
  artistName: z.string().optional(),
  albumName: z.string().optional(),
  channel: z.string().optional(), // Redirect
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
  // Deprecated
  key: z.string().optional(),
  plexFile: z.string().optional(), // Not present on offline type
  rating: z.string().optional(),
  // e.g. for Plex items, this is the rating key value
  externalKey: z.string().optional(),
  season: z.number().optional(),
  seasonIcon: z.string().optional(),
  serverKey: z.string().optional(),
  showIcon: z.string().optional(),
  showTitle: z.string().optional(), // Unclear if this is necessary
  sourceType: ExternalSourceTypeSchema,
  summary: z.string().optional(), // Not present on offline type
  title: z.string().optional(),
  type: ProgramTypeSchema,
  year: z.number().optional(),
});

// The following schemas make up a channel's programming
// They are "timeless" in the sense that they do not encode a
// start and end time (like the guide/lineup). A listing of
// these programs makes up one channel "cycle".
export const BaseProgramSchema = z.object({
  type: z.union([
    z.literal('flex'),
    z.literal('redirect'),
    z.literal('content'),
    z.literal('custom'),
  ]),
  persisted: z.boolean(),
  duration: z.number(),
  icon: z.string().optional(),
});

export const FlexProgramSchema = BaseProgramSchema.extend({
  type: z.literal('flex'),
});

export const RedirectProgramSchema = BaseProgramSchema.extend({
  type: z.literal('redirect'),
  channel: z.string(), // Channel ID
  channelNumber: z.number(),
  channelName: z.string(),
});

const OriginalProgramSchema = z.discriminatedUnion('sourceType', [
  z.object({
    sourceType: z.literal('plex'),
    program: z.discriminatedUnion('type', [
      PlexEpisodeSchema,
      PlexMovieSchema,
      PlexMusicTrackSchema,
    ]),
  }),
  z.object({
    sourceType: z.literal('jellyfin'),
    program: JellyfinItem,
  }),
]);

export type ContentProgramOriginalProgram = z.infer<
  typeof OriginalProgramSchema
>;

export const CondensedContentProgramSchema = BaseProgramSchema.extend({
  type: z.literal('content'),
  id: z.string().optional(), // Populated if persisted
  // Only populated on client requests to the server
  originalProgram: OriginalProgramSchema.optional().describe(
    "The program pulled from the relevant media source's API. This is generally only required on save/update operations",
  ),
});

export const ContentProgramTypeSchema = z.union([
  z.literal('movie'),
  z.literal('episode'),
  z.literal('track'),
]);

// Unfortunately we can't make this a discrim union, or even a regular union,
// because it is used in other discriminatedUnions and zod cannot handle this
// See:
// https://github.com/colinhacks/zod/issues/2106
// https://github.com/colinhacks/zod/issues/1884
// This stuff makes me wanna just redefine all of this...
export const ContentProgramSchema = CondensedContentProgramSchema.extend({
  subtype: ContentProgramTypeSchema,
  summary: z.string().optional(),
  date: z.string().optional(),
  rating: z.string().optional(),
  // If subtype = episode, this is the show title
  title: z.string(),
  // Episode specific stuff
  showId: z.string().optional(),
  seasonId: z.string().optional(),
  episodeTitle: z.string().optional(),
  seasonNumber: z.number().optional(),
  episodeNumber: z.number().optional(),
  // Track specific stuff
  albumId: z.string().optional(),
  artistId: z.string().optional(),
  artistName: z.string().optional(),
  albumName: z.string().optional(),
  // These will eventually replace season/track specific stuff
  index: z.number().nonnegative().optional(),
  parentIndex: z.number().nonnegative().optional(),
  grandparentIndex: z.number().nonnegative().optional(),
  // External source metadata
  externalSourceType: ExternalSourceTypeSchema.optional(),
  externalSourceName: z.string().optional(),
  externalKey: z.string().optional(),
  uniqueId: z.string(), // If persisted, this is the ID. If not persisted, this is `externalSourceType|externalSourceName|externalKey`
  externalIds: z.array(ExternalIdSchema),
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

export const CondensedCustomProgramSchema = BaseProgramSchema.extend({
  type: z.literal('custom'),
  // The ID of the underlying program
  id: z.string(),
  customShowId: z.string(),
  index: z.number(),
  program: CondensedContentProgramSchema.optional(),
});

export const CustomProgramSchema = BaseProgramSchema.extend({
  type: z.literal('custom'),
  // The ID of the underlying program
  id: z.string(),
  customShowId: z.string(),
  index: z.number(),
  program: ContentProgramSchema.optional(),
});

export const ChannelProgramSchema = z.discriminatedUnion('type', [
  ContentProgramSchema,
  CustomProgramSchema,
  RedirectProgramSchema,
  FlexProgramSchema,
]);

const startTimeOffsets = z.array(z.number());

export const ChannelProgrammingSchema = z.object({
  icon: ChannelIconSchema.optional(),
  name: z.string().optional(),
  number: z.number().optional(),
  totalPrograms: z.number(),
  programs: z.array(ChannelProgramSchema),
  startTimeOffsets,
});

export const CondensedChannelProgramSchema = z.discriminatedUnion('type', [
  CondensedContentProgramSchema,
  CondensedCustomProgramSchema,
  RedirectProgramSchema,
  FlexProgramSchema,
]);

export const CondensedChannelProgrammingSchema = z.object({
  icon: ChannelIconSchema.optional(),
  name: z.string().optional(),
  number: z.number().optional(),
  totalPrograms: z.number(),
  programs: z.record(ContentProgramSchema),
  lineup: z.array(CondensedChannelProgramSchema),
  startTimeOffsets,
  schedule: LineupScheduleSchema.optional(),
  dynamicContentConfig: DynamicContentConfigSchema.optional(),
});
