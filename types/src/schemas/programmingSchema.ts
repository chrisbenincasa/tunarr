import { z } from 'zod';
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
  ContentProgramTypeSchema,
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

export const SourceTypeSchema = z.enum(['plex', 'jellyfin', 'emby', 'local']);

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
  sourceType: SourceTypeSchema,
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

// TODO: Break this out to a union per-subtype, now that Zod 4 supports it.
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
  externalSourceType: SourceTypeSchema,
  externalSourceName: z.string(),
  externalSourceId: z.string(),
  libraryId: z.string().optional(),
  externalKey: z.string(),

  uniqueId: z.string(), // If persisted, this is the ID. If not persisted, this is `externalSourceType|externalSourceName|externalKey`
  externalIds: z.array(ExternalIdSchema),
  canonicalId: z.string().optional(),
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

export const FillerType = z.enum(['pre', 'post', 'head', 'tail', 'fallback']);
export const FillerTypes = FillerType.enum;

export const CondensedFillerProgramSchema = BaseProgramSchema.extend({
  type: z.literal('filler'),
  // The ID of the underlying program
  id: z.uuid(),
  fillerListId: z.uuid(),
  program: CondensedContentProgramSchema.optional(),
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

export const ChannelProgramSchema = z.discriminatedUnion('type', [
  ContentProgramSchema,
  CustomProgramSchema,
  RedirectProgramSchema,
  FlexProgramSchema,
  FillerProgramSchema,
]);

export const ChannelProgrammingSchema = z.object({
  icon: ChannelIconSchema.optional(),
  name: z.string().optional(),
  number: z.number().optional(),
  totalPrograms: z.number(),
  programs: z.array(ChannelProgramSchema),
  startTimeOffsets: z.array(z.number()),
});

export const CondensedChannelProgramSchema = z.discriminatedUnion('type', [
  CondensedContentProgramSchema,
  CondensedCustomProgramSchema,
  CondensedFillerProgramSchema,
  RedirectProgramSchema,
  FlexProgramSchema,
]);

//
// New stuff
//

export const NamedEntity = z.object({
  // Sometimes these entities are persisted, in which case they
  // have an ID that can be passed back to other API endpoints to
  // get more information, like thumbnail URLs.
  uuid: z.uuid().optional(),
  name: z.string(),
  externalInfo: z
    .object({
      source: SourceTypeSchema,
      id: z.string(),
    })
    .nullish(),
});

export const Actor = z.object({
  ...NamedEntity.shape,
  order: z.number().nullish(),
  role: z.string().nullish(),
  thumb: z.string().nullish(),
});

export const Writer = z.object({
  ...NamedEntity.shape,
  thumb: z.string().nullish(),
});
export const Director = z.object({
  ...NamedEntity.shape,
  thumb: z.string().nullish(),
});
export const Genre = NamedEntity;
export const Studio = NamedEntity;

const HasMediaSourceAndLibraryId = z.object({
  mediaSourceId: z.string(),
  libraryId: z.string(),
});

const WithSummaryMetadata = z.object({
  summary: z.string().nullable(),
  plot: z.string().nullable(),
  tagline: z.string().nullable(),
});

export const IdentifierSchema = z.object({
  id: z.string(),
  sourceId: z.string().optional(),
  type: ExternalIdSourceType,
});

const BaseItem = z.object({
  uuid: z.uuid(),
  canonicalId: z.string(),
  sourceType: SourceTypeSchema,
  // externalLibraryId: z.string(),
  externalId: z
    .string()
    .describe('Unique identifier for this item in the external media source'),
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
  sortTitle: z.string(),
  tags: z.array(z.string()),
  ...HasMediaSourceAndLibraryId.shape,
});

const BaseMediaLocation = z.object({
  path: z.string(),
});

export const LocalMediaLocation = BaseMediaLocation.extend({
  type: z.literal('local'),
});

export const MediaSourceMediaLocation = BaseMediaLocation.extend({
  type: z.literal('remote'),
  sourceType: MediaSourceType,
  externalKey: z.string(),
});

export const MediaChapter = z.object({
  index: z.number().nonnegative(),
  startTime: z.number().nonnegative(),
  endTime: z.number().nonnegative(),
  title: z.string().nullish(),
  chapterType: z.enum(['chapter', 'intro', 'outro']).default('chapter'),
});

export const MediaLocation = LocalMediaLocation.or(MediaSourceMediaLocation);

export const MediaStreamType = z.enum([
  'video',
  'audio',
  'subtitles',
  'attachment',
  'external_subtitles',
]);

export const MediaStream = z.object({
  index: z.number(),
  codec: z.string(),
  profile: z.string().nullish(),
  streamType: MediaStreamType,
  title: z.string().nullish(),
  hasAttachedPicture: z.boolean().nullish(),
  fileName: z.string().nullish(),
  mimeType: z.string().nullish(),

  // Video
  frameRate: z.string().or(z.number()).nullish(),
  pixelFormat: z.string().nullish(),
  bitDepth: z.number().nullish(),
  colorRange: z.string().nullish(),
  colorSpace: z.string().nullish(),
  colorTransfer: z.string().nullish(),
  colorPrimaries: z.string().nullish(),

  // Audio
  // TODO: consider breaking stream out to a union for each subtype
  channels: z.number().nullish(),

  // Subtitles
  sdh: z.boolean().nullish(),

  // Audio or Subtitles
  languageCodeISO6392: z.string().nullish(),
  selected: z.boolean().nullish(),
  default: z.boolean().nullish(),
  forced: z.boolean().nullish(),
});

export const MediaSubtitlesType = z.enum(['embedded', 'sidecar']);

export const MediaSubtitles = z.object({
  subtitleType: MediaSubtitlesType,
  title: z.string().nullish(),
  streamIndex: z.number().nullish(),
  codec: z.string(),
  default: z.boolean().nullish(),
  forced: z.boolean().nullish(),
  sdh: z.boolean().nullish(),
  language: z.string(),
  path: z.string().nullish(),
});

export const MediaArtworkType = z.enum([
  'poster',
  'thumbnail',
  'logo',
  'fanart',
  'watermark',
  'banner',
  'landscape',
]);

export const MediaArtwork = z.object({
  id: z.uuid().optional(), // Empty if artwork is not persisted
  type: MediaArtworkType,
  path: z.string().nullish(),
});

export const MediaItem = z.object({
  streams: z.array(MediaStream),
  duration: z.number().nonnegative(),
  sampleAspectRatio: z.string().nullish(),
  displayAspectRatio: z.string().nullish(),
  frameRate: z.number().or(z.string()).nullish(),
  resolution: ResolutionSchema.nullish(),
  locations: z.array(MediaLocation),
  chapters: z.array(MediaChapter).nullish(),
  scanKind: z.enum(['unknown', 'progressive', 'interlaced']).nullish(),
});

const BaseProgram = z.object({
  ...BaseItem.shape,
  type: ContentProgramTypeSchema,
  title: z.string(),
  originalTitle: z.string().nullable(),
  year: z.number().positive().nullable(),
  releaseDate: z.number().nullable().describe('Epoch timestamp'),
  releaseDateString: z.string().nullable(),
  mediaItem: MediaItem.optional(),
  actors: z.array(Actor).optional(),
  writers: z.array(Writer).optional(),
  directors: z.array(Director).optional(),
  genres: z.array(Genre).optional(),
  studios: z.array(Studio).optional(),
  duration: z.number(),
  externalSubtitles: z.array(MediaSubtitles).nullish(),
  artwork: MediaArtwork.array(),
  state: z.enum(['ok', 'missing']),
});

export const Movie = z.object({
  ...BaseProgram.shape,
  ...WithSummaryMetadata.shape,
  type: z.literal('movie'),
  rating: z.string().nullable(),
});

const MetadataOmitMask = {
  mediaItem: true,
  mediaSourceId: true,
  libraryId: true,
  externalLibraryId: true,
  canonicalId: true,
  duration: true,
  externalId: true,
} as const;

export const MovieMetadata = Movie.omit(MetadataOmitMask);

const BaseProgramGrouping = z.object({
  ...BaseItem.shape,
  ...WithSummaryMetadata.shape,
  genres: z.array(Genre).optional(),
  // e.g. for shows => seasons, seasons => episodes
  childCount: z.number().nonnegative().optional(),
  // e.g. for shows, this is episodes
  grandchildCount: z.number().nonnegative().optional(),
  artwork: MediaArtwork.array(),
});

export const Show = z.object({
  ...BaseProgramGrouping.shape,
  type: z.literal('show'),
  genres: z.array(Genre),
  actors: z.array(Actor),
  studios: z.array(Studio),
  rating: z.string().nullable(),
  releaseDate: z.number().nullable(),
  releaseDateString: z.string().nullable(),
  year: z.number().positive().nullable(),
  get seasons(): z.ZodOptional<z.ZodArray<typeof BaseSeason>> {
    return z.array(Season).optional();
  },
});

const BaseSeason = z.object({
  ...BaseProgramGrouping.shape,
  type: z.literal('season'),
  studios: z.array(Studio),
  index: z.number().nonnegative(),
  year: z.number().positive().nullable(),
  releaseDate: z.number().nullable(),
  releaseDateString: z.string().nullable(),
});

const BaseEpisode = z.object({
  ...BaseProgram.shape,
  type: z.literal('episode'),
  episodeNumber: z.number().nonnegative(),
  releaseDate: z.number().nullable(),
  releaseDateString: z.string().nullable(),
  summary: z.string().nullable(),
});

export const Season = z.object({
  ...BaseProgramGrouping.shape,
  ...BaseSeason.shape,
  get show(): z.ZodOptional<typeof Show> {
    return z.optional(Show);
  },
  get episodes(): z.ZodOptional<z.ZodArray<typeof BaseEpisode>> {
    return z.optional(z.array(BaseEpisode));
  },
});

export const ShowMetadata = Show.omit(MetadataOmitMask);
export const SeasonMetadata = Season.omit(MetadataOmitMask);
export const SeasonWithShow = z.object({
  ...Season.shape,
  // We have to override this way because of the
  // explicit type annotation for the recursive
  //types above
  get show(): typeof Show {
    return Show;
  },
});

export const Episode = z.object({
  ...BaseProgram.shape,
  ...BaseEpisode.shape,
  season: Season.optional(),
  show: Show.optional(),
});

export const EpisodeMetadata = Episode.omit(MetadataOmitMask);

export const EpisodeWithHierarchy = z.object({
  ...Episode.shape,
  season: SeasonWithShow,
});

export const MusicArtist = z.object({
  ...BaseProgramGrouping.shape,
  type: z.literal('artist'),
  get albums(): z.ZodOptional<z.ZodArray<typeof BaseMusicAlbum>> {
    return z.optional(z.array(BaseMusicAlbum));
  },
});

const BaseMusicAlbum = z.object({
  ...BaseProgramGrouping.shape,
  type: z.literal('album'),
  index: z.number().optional(),
  year: z.number().positive().nullable(),
  releaseDate: z.number().nullable(),
  releaseDateString: z.string().nullable(),
  studios: z.array(Studio).optional(),
});

const BaseMusicTrack = z.object({
  ...BaseProgram.shape,
  type: z.literal('track'),
  trackNumber: z.number().nonnegative(),
});

export const MusicAlbum = z.object({
  ...BaseProgramGrouping.shape,
  ...BaseMusicAlbum.shape,
  artist: MusicArtist.optional(),
  get tracks(): z.ZodOptional<z.ZodArray<typeof BaseMusicTrack>> {
    return z.optional(z.array(BaseMusicTrack));
  },
});

export const MusicTrack = z.object({
  ...BaseMusicTrack.shape,
  album: MusicAlbum.optional(),
  artist: MusicArtist.optional(),
});

export const MusicAlbumWithArtist = MusicAlbum.required({ artist: true });

export const MusicTrackWithHierarchy = z.object({
  ...MusicTrack.shape,
  album: MusicAlbumWithArtist,
});

export const MusicVideo = BaseProgram.extend({
  type: z.literal('music_video'),
});

export const OtherVideo = BaseProgram.extend({
  type: z.literal('other_video'),
});

export const OtherVideoMetadata = OtherVideo.omit(MetadataOmitMask);

export const HasMediaSourceInfo = z.object({
  sourceType: MediaSourceType,
  externalId: z.string(),
});

const PlexMixin = HasMediaSourceInfo.extend({
  sourceType: z.literal(MediaSourceType.enum.plex),
});

const PlexMovie = Movie.and(PlexMixin);

export type PlexMovie = z.infer<typeof PlexMovie>;

export const BaseStructuralGrouping = z.object({
  sourceType: SourceTypeSchema,
  uuid: z.uuid(),
  title: z.string(),
  childCount: z.number().optional(),
  externalId: z.string(),
  childType: z
    .enum([
      ...Object.values(ContentProgramTypeSchema.enum),
      'season',
      'show',
      'album',
      'artist',
    ])
    .optional(),
});

export const Folder = z.object({
  ...BaseStructuralGrouping.shape,
  ...HasMediaSourceAndLibraryId.shape,
  type: z.literal('folder'),
});

export const Collection = z.object({
  ...BaseStructuralGrouping.shape,
  ...HasMediaSourceAndLibraryId.shape,
  type: z.literal('collection'),
});

export const Playlist = z.object({
  ...BaseStructuralGrouping.shape,
  ...HasMediaSourceAndLibraryId.shape,
  type: z.literal('playlist'),
});

export const Library = z.object({
  ...BaseStructuralGrouping.shape,
  type: z.literal('library'),
  locations: MediaLocation.array(),
  libraryId: z.uuid().optional(),
});

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

export const StructuralProgramGroupingSchema = z.union([
  Folder,
  Collection,
  Playlist,
]);

export const TerminalProgramSchema = z.union([
  Movie,
  Episode,
  MusicTrack,
  OtherVideo,
  MusicVideo,
]);

export const ItemOrFolder = TerminalProgramSchema.or(ProgramGroupingSchema).or(
  StructuralProgramGroupingSchema,
);

export const Person = z.discriminatedUnion('type', [
  Actor.extend({ type: z.literal('actor') }),
  Writer.extend({ type: z.literal('writer') }),
  Director.extend({ type: z.literal('director') }),
]);

z.globalRegistry.add(Show, { id: 'Show' });
z.globalRegistry.add(Season, { id: 'Season' });
z.globalRegistry.add(Episode, { id: 'Episode' });
z.globalRegistry.add(MusicArtist, { id: 'MusicArtist' });
z.globalRegistry.add(MusicAlbum, { id: 'MusicAlbum' });
z.globalRegistry.add(MusicTrack, { id: 'MusicTrack' });
