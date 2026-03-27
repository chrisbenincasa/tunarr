import { z } from 'zod';
import { ResolutionSchema } from './miscSchemas.js';
import { MediaSourceType } from './settingsSchemas.js';
import {
  ContentProgramTypeSchema,
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

const WithMediaSourceDetails = z.object({
  mediaSourceId: z.string(),
  libraryId: z.string(),
});

const WithTunarrMetadata = z.object({
  ...WithMediaSourceDetails.shape,
  canonicalId: z.string(),
  externalId: z
    .string()
    .describe('Unique identifier for this item in the external media source'),
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
  sourceType: SourceTypeSchema,
  // externalLibraryId: z.string(),
  // externalId: z
  //   .string()
  //   .describe('Unique identifier for this item in the external media source'),
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
  // ...HasMediaSourceAndLibraryId.shape,
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

const WithMediaItemMetadata = z.object({
  mediaItem: MediaItem.optional(),
  duration: z.number(),
});

const BaseProgram = z.object({
  ...BaseItem.shape,
  type: ContentProgramTypeSchema,
  title: z.string(),
  originalTitle: z.string().nullable(),
  year: z.number().positive().nullable(),
  releaseDate: z.number().nullable().describe('Epoch timestamp'),
  releaseDateString: z.string().nullable(),
  actors: z.array(Actor).optional(),
  writers: z.array(Writer).optional(),
  directors: z.array(Director).optional(),
  genres: z.array(Genre).optional(),
  studios: z.array(Studio).optional(),
  externalSubtitles: z.array(MediaSubtitles).nullish(),
  artwork: MediaArtwork.array(),
  state: z.enum(['ok', 'missing']),
  // mediaItem: MediaItem.optional(),
  // duration: z.number(),
});

export const MovieMetadata = z.object({
  ...BaseProgram.shape,
  ...WithSummaryMetadata.shape,
  type: z.literal('movie'),
  rating: z.string().nullable(),
});

export const Movie = z.object({
  ...MovieMetadata.shape,
  ...WithTunarrMetadata.shape,
  ...WithMediaItemMetadata.shape,
});

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

export const SeasonMetadata = z.object({
  ...BaseProgramGrouping.shape,
  type: z.literal('season'),
  studios: z.array(Studio),
  index: z.number().nonnegative(),
  year: z.number().positive().nullable(),
  releaseDate: z.number().nullable(),
  releaseDateString: z.string().nullable(),
});

const _SeasonWithTunarrMetadata = z.object({
  ...SeasonMetadata.shape,
  ...WithTunarrMetadata.shape,
});

export const ShowMetadata = z.object({
  ...BaseProgramGrouping.shape,
  type: z.literal('show'),
  genres: z.array(Genre),
  actors: z.array(Actor),
  studios: z.array(Studio),
  rating: z.string().nullable(),
  releaseDate: z.number().nullable(),
  releaseDateString: z.string().nullable(),
  year: z.number().positive().nullable(),
  get seasons(): z.ZodOptional<z.ZodArray<typeof _SeasonWithTunarrMetadata>> {
    return z.array(_SeasonWithTunarrMetadata).optional();
  },
});

export const Show = z.object({
  ...ShowMetadata.shape,
  ...WithTunarrMetadata.shape,
});

const BaseEpisode = z.object({
  ...BaseProgram.shape,
  type: z.literal('episode'),
  episodeNumber: z.number().nonnegative(),
  releaseDate: z.number().nullable(),
  releaseDateString: z.string().nullable(),
  summary: z.string().nullable(),
});

const BaseEpisodeWithoutJoins = z.object({
  ...BaseEpisode.shape,
  ...WithTunarrMetadata.shape,
  ...WithMediaItemMetadata.shape,
});

export const Season = z.object({
  ...SeasonMetadata.shape,
  ...WithTunarrMetadata.shape,
  get show(): z.ZodOptional<typeof Show> {
    return z.optional(Show);
  },
  get episodes(): z.ZodOptional<z.ZodArray<typeof BaseEpisodeWithoutJoins>> {
    return z.optional(z.array(BaseEpisodeWithoutJoins));
  },
});

export const SeasonWithShow = z.object({
  ...Season.shape,
  // We have to override this way because of the
  // explicit type annotation for the recursive
  //types above
  get show(): typeof Show {
    return Show;
  },
});

export const EpisodeMetadata = z.object({
  ...BaseProgram.shape,
  ...BaseEpisode.shape,
  season: Season.optional(),
  show: Show.optional(),
});

export const Episode = z.object({
  ...EpisodeMetadata.shape,
  ...WithTunarrMetadata.shape,
  ...WithMediaItemMetadata.shape,
});

export const EpisodeWithHierarchy = z.object({
  ...Episode.shape,
  season: SeasonWithShow,
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

const BaseMusicAlbumWithoutJoins = z.object({
  ...BaseMusicAlbum.shape,
  ...WithTunarrMetadata.shape,
});

export const MusicArtistMetadata = z.object({
  ...BaseProgramGrouping.shape,
  type: z.literal('artist'),
  get albums(): z.ZodOptional<z.ZodArray<typeof BaseMusicAlbumWithoutJoins>> {
    return z.optional(z.array(BaseMusicAlbumWithoutJoins));
  },
});

export const MusicArtist = z.object({
  ...MusicArtistMetadata.shape,
  ...WithTunarrMetadata.shape,
});

const BaseMusicTrack = z.object({
  ...BaseProgram.shape,
  type: z.literal('track'),
  trackNumber: z.number().nonnegative(),
});

const BaseMusicTrackWithoutJoins = z.object({
  ...BaseMusicTrack.shape,
  ...WithTunarrMetadata.shape,
  ...WithMediaItemMetadata.shape,
});

export const MusicAlbumMetadata = z.object({
  ...BaseProgramGrouping.shape,
  ...BaseMusicAlbum.shape,
  artist: MusicArtist.optional(),
  get tracks(): z.ZodOptional<z.ZodArray<typeof BaseMusicTrackWithoutJoins>> {
    return z.optional(z.array(BaseMusicTrackWithoutJoins));
  },
});

export const MusicAlbum = z.object({
  ...MusicAlbumMetadata.shape,
  ...WithTunarrMetadata.shape,
});

export const MusicTrackMetadata = z.object({
  ...BaseMusicTrack.shape,
  album: MusicAlbum.optional(),
  artist: MusicArtist.optional(),
});

export const MusicTrack = z.object({
  ...MusicTrackMetadata.shape,
  ...WithTunarrMetadata.shape,
  ...WithMediaItemMetadata.shape,
});

export const MusicAlbumWithArtist = MusicAlbum.required({ artist: true });

export const MusicTrackWithHierarchy = z.object({
  ...MusicTrack.shape,
  album: MusicAlbumWithArtist,
});

export const MusicVideo = z.object({
  ...BaseProgram.shape,
  ...WithTunarrMetadata.shape,
  ...WithMediaItemMetadata.shape,
  type: z.literal('music_video'),
});

export const OtherVideoMetadata = z.object({
  ...BaseProgram.shape,
  type: z.literal('other_video'),
});

export const OtherVideo = z.object({
  ...OtherVideoMetadata.shape,
  ...WithTunarrMetadata.shape,
  ...WithMediaItemMetadata.shape,
});

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
  ...WithMediaSourceDetails.shape,
  type: z.literal('folder'),
});

export const Collection = z.object({
  ...BaseStructuralGrouping.shape,
  ...WithMediaSourceDetails.shape,
  type: z.literal('collection'),
});

export const Playlist = z.object({
  ...BaseStructuralGrouping.shape,
  ...WithMediaSourceDetails.shape,
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

z.globalRegistry.add(TerminalProgramSchema, { id: 'TerminalProgram' });
z.globalRegistry.add(Show, { id: 'Show' });
z.globalRegistry.add(Season, { id: 'Season' });
z.globalRegistry.add(Episode, { id: 'Episode' });
z.globalRegistry.add(MusicArtist, { id: 'MusicArtist' });
z.globalRegistry.add(MusicAlbum, { id: 'MusicAlbum' });
z.globalRegistry.add(MusicTrack, { id: 'MusicTrack' });
