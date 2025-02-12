import z from 'zod/v4';
import {
  DynamicContentConfigSchema,
  LineupScheduleSchema,
} from '../api/Scheduling.js';
import { EmbyItemSchema } from '../emby/index.js';
import { JellyfinItem } from '../jellyfin/index.js';
import {
  PlexEpisodeSchema,
  PlexMovieSchema,
  PlexMusicTrackSchema,
} from '../plex/index.js';
import { ResolutionSchema } from './miscSchemas.js';
import { MediaSourceType } from './settingsSchemas.js';
import {
  ChannelIconSchema,
  ExternalIdSchema,
  ExternalIdSourceType,
} from './utilSchemas.js';

export const ProgramTypeSchema = z.union([
  z.literal('movie'),
  z.literal('episode'),
  z.literal('track'),
  z.literal('redirect'),
  z.literal('custom'),
  z.literal('flex'),
]);

export const ExternalSourceTypeSchema = z.enum(['plex', 'jellyfin', 'emby']);

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
    z.literal('filler'),
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
  id: z.string().optional(), // Populated if persisted
  duration: z.number().min(0),
});

export const ContentProgramTypeSchema = z.enum([
  'movie',
  'episode',
  'track',
  'music_video',
  'other_video',
]);

export type ContentProgramType = z.infer<typeof ContentProgramTypeSchema>;

const BaseContentProgramParentSchema = z.object({
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
  parent: TvSeasonContentProgramSchema.or(
    MusicAlbumContentProgramSchema,
  ).optional(),
  grandparent: TvShowContentProgramSchema.or(
    MusicArtistContentProgramSchema,
  ).optional(),
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

export const CondensedFillerProgramSchema = BaseProgramSchema.extend({
  type: z.literal('filler'),
  // The ID of the underlying program
  id: z.uuid(),
  fillerListId: z.uuid(),
  program: CondensedContentProgramSchema.optional(),
});

export type CondensedFillerProgram = z.infer<
  typeof CondensedFillerProgramSchema
>;

export const FillerProgramSchema = BaseProgramSchema.extend({
  type: z.literal('filler'),
  id: z.uuid(),
  fillerListId: z.uuid(),
  program: ContentProgramSchema.optional(),
});

export const ChannelProgramSchema = z.discriminatedUnion('type', [
  ContentProgramSchema,
  CustomProgramSchema,
  RedirectProgramSchema,
  FlexProgramSchema,
  FillerProgramSchema,
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
  CondensedFillerProgramSchema,
  RedirectProgramSchema,
  FlexProgramSchema,
]);

export const CondensedChannelProgrammingSchema = z.object({
  icon: ChannelIconSchema.optional(),
  name: z.string().optional(),
  number: z.number().optional(),
  totalPrograms: z.number(),
  programs: z.record(z.string(), ContentProgramSchema),
  lineup: z.array(CondensedChannelProgramSchema),
  startTimeOffsets,
  schedule: LineupScheduleSchema.optional(),
  dynamicContentConfig: DynamicContentConfigSchema.optional(),
});

//
// New stuff
//

const NamedEntity = z.object({
  name: z.string(),
});

const ActorSchema = NamedEntity;
const WriterSchema = NamedEntity;
const DirectorSchema = NamedEntity;
const GenreSchema = NamedEntity;
const StudioSchema = NamedEntity;

const HasMediaSourceAndLibraryId = z.object({
  mediaSourceId: z.string(),
  libraryId: z.string(),
});

const WithSummaryMetadata = z.object({
  summary: z.string().nullable(),
  plot: z.string().nullable(),
  tagline: z.string().nullable(),
});

const IdentifierSchema = z.object({
  id: z.string(),
  sourceId: z.string().optional(),
  type: ExternalIdSourceType,
});

const BaseItem = z
  .object({
    uuid: z.string().uuid(),
    canonicalId: z.string(),
    // TODO: break out gropuing types to separate schema
    type: z.enum([
      ...ContentProgramTypeSchema.options,
      'show',
      'season',
      'album',
      'artist',
    ]),
    identifiers: z.array(IdentifierSchema),
    title: z.string(),
  })
  .merge(HasMediaSourceAndLibraryId);

const BaseMediaLocation = z.object({
  path: z.string(),
});

const LocalMediaLocation = BaseMediaLocation.extend({
  type: z.literal('local'),
});

const MediaSourceMediaLocation = BaseMediaLocation.extend({
  type: z.literal('remote'),
  sourceType: MediaSourceType,
  externalKey: z.string(),
});

const MediaLocation = LocalMediaLocation.or(MediaSourceMediaLocation);

const MediaStreamType = z.enum([
  'video',
  'audio',
  'subtitles',
  'attachment',
  'external_subtitles',
]);

const MediaStream = z.object({
  index: z.number(),
  codec: z.string(),
  profile: z.string(),
  streamType: MediaStreamType,
  languageCodeISO6392: z.string().optional(),
  // TODO: consider breaking stream out to a union for each subtype
  channels: z.number().optional(),
  title: z.string().optional(),
  default: z.boolean().optional(),
  hasAttachedPicture: z.boolean().optional(),
  pixelFormat: z.string().optional(),
  bitDepth: z.number().optional(),
  fileName: z.string().optional(),
  mimeType: z.string().optional(),
  selected: z.boolean().optional(),
});

const MediaItem = z.object({
  streams: z.array(MediaStream),
  duration: z.number().nonnegative(),
  sampleAspectRatio: z.string(),
  displayAspectRatio: z.string(),
  frameRate: z.number().or(z.string()).optional(),
  resolution: ResolutionSchema,
  locations: z.array(MediaLocation),
});

const BaseProgram = BaseItem.extend({
  type: ContentProgramTypeSchema,
  title: z.string(),
  originalTitle: z.string().nullable(),
  year: z.number().positive().nullable(),
  releaseDate: z.number().positive().nullable(),
  mediaItem: MediaItem,
  actors: z.array(ActorSchema).optional(),
  writers: z.array(WriterSchema).optional(),
  directors: z.array(DirectorSchema).optional(),
  genres: z.array(GenreSchema).optional(),
  studios: z.array(StudioSchema).optional(),
  duration: z.number(),
});

export const Movie = BaseProgram.extend({
  type: z.literal('movie'),
  rating: z.string().nullable(),
}).and(WithSummaryMetadata);

const BaseProgramGrouping = BaseItem.merge(WithSummaryMetadata).extend({
  // e.g. for shows => seasons, seasons => episodes
  childCount: z.number().nonnegative().optional(),
  // e.g. for shows, this is episodes
  grandchildCount: z.number().nonnegative().optional(),
});

export const Show = BaseProgramGrouping.extend({
  type: z.literal('show'),
  genres: z.array(GenreSchema),
  actors: z.array(ActorSchema),
  studios: z.array(StudioSchema),
  year: z.number().positive().nullable(),
});

export const Season = BaseProgramGrouping.extend({
  type: z.literal('season'),
  studios: z.array(StudioSchema),
  index: z.number().nonnegative(),
  year: z.number().positive().nullable(),
  show: Show.optional(),
});

export const Episode = BaseProgram.extend({
  type: z.literal('episode'),
  episodeNumber: z.number().nonnegative(),
  summary: z.string().nullable(),
  season: Season.optional(),
});

export const MusicArtist = BaseProgramGrouping.extend({
  type: z.literal('artist'),
});

export const MusicAlbum = BaseProgramGrouping.extend({
  type: z.literal('album'),
  year: z.number().positive().nullable(),
  artist: MusicArtist.optional(),
});

export const MusicTrack = BaseProgram.extend({
  type: z.literal('track'),
  trackNumber: z.number().positive(),
  album: MusicAlbum.optional(),
});

export const MusicVideo = BaseProgram.extend({
  type: z.literal('music_video'),
});

export const OtherVideo = BaseProgram.extend({
  type: z.literal('other_video'),
});

const HasMediaSourceInfo = z.object({
  sourceType: MediaSourceType,
  externalKey: z.string(),
});

const PlexMixin = HasMediaSourceInfo.extend({
  sourceType: z.literal(MediaSourceType.enum.plex),
});

const PlexMovie = Movie.and(PlexMixin);

export type PlexMovie = z.infer<typeof PlexMovie>;

export const ItemSchema = z.union([
  Movie,
  Episode,
  Season,
  Show,
  MusicTrack,
  MusicAlbum,
  MusicArtist,
  MusicVideo,
  OtherVideo,
]);

export const ProgramGroupingSchema = z.union([
  Show,
  Season,
  MusicArtist,
  MusicAlbum,
]);

export const TerminalProgramSchema = z.union([Movie, Episode, MusicTrack]);
