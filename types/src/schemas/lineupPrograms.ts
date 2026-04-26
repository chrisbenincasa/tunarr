import z from 'zod/v4';
import { EmbyItemSchema } from '../emby/index.js';
import { JellyfinItem } from '../jellyfin/index.js';
import {
  PlexEpisodeSchema,
  PlexMovieSchema,
  PlexMusicTrackSchema,
} from '../plex/index.js';
import { TerminalProgramSchema } from './programmingSchema.js';
import type { ContentProgramTypeSchema } from './utilSchemas.js';
import { ExternalIdSchema } from './utilSchemas.js';

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
    z.literal('filler'),
  ]),
  duration: z.number().positive(),
  icon: z.string().optional(),
});

export const OfflineFillerConfigSchema = z.object({
  fillerListIds: z.array(z.string().uuid()).optional(),
  fillerRepeatCooldownMs: z.number().nonnegative().optional(),
  fillerListCooldownOverrides: z
    .record(z.string(), z.number().nonnegative())
    .optional(),
  origin: z.enum(['flex', 'midroll']).default('flex').optional(),
});

export type OfflineFillerConfig = z.infer<typeof OfflineFillerConfigSchema>;

export const FlexProgramSchema = BaseProgramSchema.extend({
  type: z.literal('flex'),
  fillerConfig: OfflineFillerConfigSchema.optional(),
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
  z.object({
    sourceType: z.literal('emby'),
    program: EmbyItemSchema,
  }),
]);

export type ContentProgramOriginalProgram = z.infer<
  typeof OriginalProgramSchema
>;

export const CondensedContentProgramSchema = BaseProgramSchema.extend({
  type: z.literal('content'),
  id: z.string(),
  duration: z.number().min(0),
  startOffsetMs: z.number().nonnegative().optional(),
});

export type CondensedContentProgram = z.infer<
  typeof CondensedContentProgramSchema
>;

export type ContentProgramType = z.infer<typeof ContentProgramTypeSchema>;

const BaseContentProgramParentSchema = z.object({
  // ID of the program_grouping in Tunarr
  id: z.string().optional(),
  // title - e.g. album, show, etc
  title: z.string().optional(),
  // Index of this parent relative to its grandparent
  // e.g. season number
  index: z.coerce.number().nonnegative().optional().catch(undefined),
  guids: z.array(z.string()).optional(),
  year: z.number().nonnegative().optional().catch(undefined),
  externalKey: z.string().optional(),
  externalIds: z.array(ExternalIdSchema),
  summary: z.string().optional(),
});

export const TvSeasonContentProgramSchema = z.object({
  ...BaseContentProgramParentSchema.shape,
  type: z.literal('season'),
});

export const TvShowContentProgramSchema = z.object({
  ...BaseContentProgramParentSchema.shape,
  type: z.literal('show'),
  seasons: z.array(BaseContentProgramParentSchema).optional(),
});

export const MusicAlbumContentProgramSchema = z.object({
  ...BaseContentProgramParentSchema.shape,
  type: z.literal('album'),
});

export const MusicArtistContentProgramSchema = z.object({
  ...BaseContentProgramParentSchema.shape,
  type: z.literal('artist'),
  albums: z.array(BaseContentProgramParentSchema).optional(),
});

export const ContentProgramParentSchema = z.discriminatedUnion('type', [
  TvSeasonContentProgramSchema,
  TvShowContentProgramSchema,
  MusicAlbumContentProgramSchema,
  MusicArtistContentProgramSchema,
]);

export const ContentProgramSchema = CondensedContentProgramSchema.extend({
  program: TerminalProgramSchema,
});

export const CondensedCustomProgramSchema = BaseProgramSchema.extend({
  type: z.literal('custom'),
  // The ID of the underlying program
  id: z.string(),
  customShowId: z.string(),
  index: z.number(),
  // program: CondensedContentProgramSchema.optional(),
});

export type CondensedCustomProgram = z.infer<
  typeof CondensedCustomProgramSchema
>;

export const CustomProgramSchema = BaseProgramSchema.extend({
  type: z.literal('custom'),
  // The ID of the underlying program
  id: z.string(),
  customShowId: z.string(),
  index: z.number(),
  program: ContentProgramSchema.optional(),
});

export const FillerType = z.enum([
  'pre',
  'post',
  'head',
  'tail',
  'fallback',
  'mid',
]);
export const FillerTypes = FillerType.enum;

export const CondensedFillerProgramSchema = BaseProgramSchema.extend({
  type: z.literal('filler'),
  // The ID of the underlying program
  id: z.uuid(),
  fillerListId: z.uuid(),
  fillerType: FillerType.optional(),
});

export type CondensedFillerProgram = z.infer<
  typeof CondensedFillerProgramSchema
>;

export const FillerProgramSchema = z.object({
  ...BaseProgramSchema.shape,
  ...CondensedFillerProgramSchema.shape,
  program: ContentProgramSchema.optional(),
});
