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

export const ExternalSourceTypeSchema = z.enum(['plex', 'jellyfin']);

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

export const OriginalProgramSchema = z.discriminatedUnion('sourceType', [
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
  duration: z.number().min(0),
});

export const ContentProgramTypeSchema = z.enum(['movie', 'episode', 'track']);

export type ContentProgramType = z.infer<typeof ContentProgramTypeSchema>;

export const ContentProgramParentSchema = z.object({
  // ID of the program_grouping in Tunarr
  id: z.string().optional(),
  // title - e.g. album, show, etc
  title: z.string().optional(),
  // Index of this parent relative to its grandparent
  // e.g. season number
  index: z.coerce.number().nonnegative().optional().catch(undefined),
  // externalIds: z.array(ExternalIdSchema).default([]),
  guids: z.array(z.string()).optional(),
  year: z.number().nonnegative().optional().catch(undefined),
  externalKey: z.string().optional(),
  externalIds: z.array(ExternalIdSchema),
});

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
  year: z.coerce.number().nonnegative().optional().catch(undefined),
  rating: z.string().optional(),

  // Path to the file exposed from the server's API
  // e.g. Plex exposes a /library/parts/XYZ/123/file.CONTAINER endpoint
  serverFileKey: z.string().optional(),
  // The disk file path as seen from the server
  serverFilePath: z.string().optional(),
  title: z.string(),
  // Episode specific stuff
  // DEPRECATED: Use parentId/grandparentId
  showId: z.string().optional(),
  seasonId: z.string().optional(),
  // Deprecated use parent.index
  seasonNumber: z.number().optional(),
  // DEPRECATED: Use index
  episodeNumber: z.number().optional(),
  // Track specific stuff
  // DEPRECATED: Use parentId/grandparentId
  albumId: z.string().optional(),
  artistId: z.string().optional(),

  // Index of this item relative to its parent
  index: z.number().nonnegative().optional().catch(undefined),
  // ID of the program_grouping in Tunarr
  parent: ContentProgramParentSchema.optional(),
  grandparent: ContentProgramParentSchema.optional(),
  // External source metadata
  externalSourceType: ExternalSourceTypeSchema,
  externalSourceName: z.string(),
  externalSourceId: z.string(),
  externalKey: z.string(),

  uniqueId: z.string(), // If persisted, this is the ID. If not persisted, this is `externalSourceType|externalSourceName|externalKey`
  externalIds: z.array(ExternalIdSchema),
});

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
