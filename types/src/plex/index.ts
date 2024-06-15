import z from 'zod';

export * from './dvr.js';

type Alias<t> = t & { _?: never };

// Marker field used to allow directories and non-directories both have
// this field. This is never defined for non-directories, but can be
// used in type-guards to differentiate
const neverDirectory = z.object({ directory: z.unknown().optional() });

// Represents an object that as a tag=>string value
export const PlexJoinItemSchema = z.object({
  tag: z.string(),
});

export type PlexJoinItem = z.infer<typeof PlexJoinItemSchema>;

export const PlexMediaTypeSchema = z.union([
  z.literal('movie'),
  z.literal('show'),
  z.literal('artist'),
]);

export const PlexLibrarySectionSchema = z.object({
  allowSync: z.boolean(),
  art: z.string(),
  composite: z.string(),
  filters: z.boolean(),
  refreshing: z.boolean(),
  thumb: z.string(),
  key: z.string(),
  type: PlexMediaTypeSchema,
  title: z.string(),
  agent: z.string(),
  scanner: z.string(),
  language: z.string(),
  uuid: z.string(),
  updatedAt: z.number().optional(),
  createdAt: z.number(),
  scannedAt: z.number(),
  content: z.boolean(),
  directory: z.boolean(),
  contentChangedAt: z.number(),
  hidden: z.number().transform((n) => n === 1),
  // TODO should we break this out into a discrim union based
  // on the type field?
  Location: z.array(z.object({ id: z.number(), path: z.string() })).optional(),
  // Potentially present for artists
  Genre: z.array(PlexJoinItemSchema).optional(),
  Country: z.array(PlexJoinItemSchema).optional(),
});

export const PlexLibrarySectionsSchema = z.object({
  size: z.number(),
  title1: z.string(),
  Directory: z.array(PlexLibrarySectionSchema),
});

export type PlexLibrarySection = Alias<
  z.infer<typeof PlexLibrarySectionSchema>
>;

export type PlexLibrarySections = z.infer<typeof PlexLibrarySectionsSchema>;

export const PlexLibraryCollectionSchema = z
  .object({
    ratingKey: z.string(),
    key: z.string(),
    guid: z.string(),
    type: z.literal('collection'),
    title: z.string(),
    titleSort: z.string(),
    subtype: z.string(),
    contentRating: z.string().optional(),
    summary: z.string(),
    index: z.number(),
    content: z.string().optional(),
    ratingCount: z.number(),
    thumb: z.string(),
    addedAt: z.number(),
    updatedAt: z.number().optional(),
    childCount: z.string(),
    collectionSort: z.string().optional(),
    smart: z.string(),
    maxYear: z.string().optional(),
    minYear: z.string().optional(),
  })
  .merge(neverDirectory);

export type PlexLibraryCollection = z.infer<typeof PlexLibraryCollectionSchema>;

const basePlexMediaContainerSchema = z.object({
  size: z.number(),
  totalSize: z.number().optional(), // Present when paging
  offset: z.number().optional(), // Present when paging
});

const basePlexCollectionSchema = z.object({
  allowSync: z.boolean(),
  art: z.string(),
  identifier: z.string(),
  librarySectionID: z.number(),
  librarySectionTitle: z.string(),
  librarySectionUUID: z.string(),
  mediaTagPrefix: z.string(),
  mediaTagVersion: z.number(),
  nocache: z.boolean().optional(),
  size: z.number(),
  totalSize: z.number().optional(), // Present when paging
  offset: z.number().optional(),
  thumb: z.string(),
  title1: z.string(),
  title2: z.string(),
  viewGroup: z.string(),
  viewMode: z.number(),
});

const basePlexLibrarySchema = basePlexCollectionSchema.extend({
  type: PlexMediaTypeSchema,
});

const basePlexChildCollectionSchema = basePlexCollectionSchema.extend({
  parentIndex: z.number(),
  parentTitle: z.string(),
  parentThumb: z.string().optional(),
});

const basePlexGrandchildCollectionSchema = basePlexChildCollectionSchema.extend(
  {
    grandparentRatingKey: z.number().optional(),
    grandparentThumb: z.string().optional(),
    grandparentTitle: z.string(),
    parentYear: z.number().optional(),
  },
);

const makePlexLibraryCollectionsSchema = <T extends z.AnyZodObject>(
  metadata: T,
) => {
  return basePlexLibrarySchema.extend({
    Metadata: z.array(metadata).optional(), // There might be no collections
  });
};

// /library/sections/{id}/collections
export const PlexLibraryCollectionsSchema = makePlexLibraryCollectionsSchema(
  PlexLibraryCollectionSchema,
);

export type PlexLibraryCollections = z.infer<
  typeof PlexLibraryCollectionsSchema
>;

// /playlists
export const PlexPlaylistSchema = z.object({
  ratingKey: z.string(),
  key: z.string(),
  guid: z.string(),
  type: z.literal('playlist'),
  title: z.string(),
  titleSort: z.string().optional(),
  summary: z.string().optional(),
  smart: z.boolean().optional(),
  playlistType: z.union([z.literal('video'), z.literal('audio')]).optional(), // Add new known types here
  composite: z.string().optional(), // Thumb path
  icon: z.string().optional(),
  viewCount: z.number().optional(),
  lastViewedAt: z.number().optional(),
  duration: z.number().optional(),
  leafCount: z.number().optional(),
  addedAt: z.number().optional(),
  updatedAt: z.number().optional(),
});

export type PlexPlaylist = z.infer<typeof PlexPlaylistSchema>;

export const PlexPlaylistsSchema = basePlexMediaContainerSchema.extend({
  Metadata: z.array(PlexPlaylistSchema).default([]),
});

export type PlexPlaylists = z.infer<typeof PlexPlaylistsSchema>;

const BasePlexMediaStreamSchema = z.object({
  id: z.number().optional(),
  default: z.boolean().optional(),
  codec: z.string(),
  index: z.number(),
  bitrate: z.number().optional(),
  bitDepth: z.number().optional(),
  displayTitle: z.string().optional(),
});

export const PlexMediaVideoStreamSchema = BasePlexMediaStreamSchema.extend({
  streamType: z.literal(1),
  chromaLocation: z.string().optional(),
  chromaSubsampling: z.string().optional(),
  codedHeight: z.number().optional(),
  codedWidth: z.number().optional(),
  colorPrimaries: z.string().optional(),
  colorRange: z.string().optional(),
  colorSpace: z.string().optional(),
  colorTrc: z.string().optional(),
  frameRate: z.number(),
  hasScalingMatrix: z.boolean().optional(),
  height: z.number(),
  width: z.number(),
  level: z.number().optional(),
  profile: z.string().optional(),
  scanType: z.string().optional(),
  anamorphic: z.string().or(z.boolean()).optional(),
  pixelAspectRatio: z.string().optional(),
});

export type PlexMediaVideoStream = z.infer<typeof PlexMediaVideoStreamSchema>;

export const PlexMediaAudioStreamSchema = BasePlexMediaStreamSchema.extend({
  streamType: z.literal(2),
  selected: z.boolean().optional(),
  channels: z.number().optional(),
  language: z.string().optional(),
  languageTag: z.string().optional(),
  languageCode: z.string().optional(),
  audioChannelLayout: z.string().optional(),
  profile: z.string().optional(),
  samplingRate: z.number().optional(),
});

export type PlexMediaAudioStream = z.infer<typeof PlexMediaAudioStreamSchema>;

export const PlexMediaSubtitleStreamSchema = BasePlexMediaStreamSchema.extend({
  streamType: z.literal(3),
  language: z.string().optional(),
  languageTag: z.string().optional(),
  languageCode: z.string().optional(),
  headerCompression: z.boolean().optional(),
}).partial({
  bitrate: true,
  index: true,
});

export const PlexMediaLyricsStreamSchema = BasePlexMediaStreamSchema.extend({
  streamType: z.literal(4),
  minLines: z.string().optional(),
  provider: z.string().optional(),
  timed: z.string().optional(), // Boolean indicator string
}).partial({
  index: true,
});

export type PlexMediaSubtitleStream = z.infer<
  typeof PlexMediaSubtitleStreamSchema
>;

export const PlexMediaStreamSchema = z.discriminatedUnion('streamType', [
  PlexMediaVideoStreamSchema,
  PlexMediaAudioStreamSchema,
  PlexMediaSubtitleStreamSchema,
  PlexMediaLyricsStreamSchema,
]);

export const PlexMediaDescriptionSchema = z.object({
  id: z.number(),
  duration: z.number(),
  bitrate: z.number(),
  width: z.number().optional(), // Video only
  height: z.number().optional(), // Video only
  aspectRatio: z.number().optional(), // Video only
  audioChannels: z.number().optional(),
  audioCodec: z.string().optional(),
  videoCodec: z.string().optional(), // Video only
  videoResolution: z.string().optional(), // Video only
  container: z.string().optional(),
  videoFrameRate: z.string().optional(), // Video only
  audioProfile: z.string().optional(),
  videoProfile: z.string().optional(), // Video only
  Part: z.array(
    z.object({
      id: z.number(),
      key: z.string(),
      duration: z.number().optional(),
      file: z.string(),
      size: z.number(),
      audioProfile: z.string().optional(),
      container: z.string().optional(),
      videoProfile: z.string().optional(), // video only
      Stream: z.array(PlexMediaStreamSchema).optional(),
    }),
  ),
});

export type PlexMediaDescription = z.infer<typeof PlexMediaDescriptionSchema>;

// We have to be totally sure these fields apply to ALL media types before
// adding here.
const BasePlexMediaSchema = z.object({
  ratingKey: z.string(),
  key: z.string(),
  guid: z.string(),
  Guid: z.array(z.object({ id: z.string() })).optional(),
});

export const PlexMovieSchema = BasePlexMediaSchema.extend({
  editionTitle: z.string().optional(),
  studio: z.string().optional(),
  type: z.literal('movie'),
  title: z.string(),
  titleSort: z.string().optional(),
  contentRating: z.string().optional(),
  summary: z.string().optional(),
  rating: z.number().optional(),
  audienceRating: z.number().optional(),
  year: z.number().optional(),
  tagline: z.string().optional(),
  thumb: z.string().optional(),
  art: z.string().optional(),
  duration: z.number(),
  originallyAvailableAt: z.string().optional(),
  addedAt: z.number(),
  updatedAt: z.number().optional(),
  audienceRatingImage: z.string().optional(),
  chapterSource: z.string().optional(),
  primaryExtraKey: z.string().optional(),
  ratingImage: z.string().optional(),
  Media: z.array(PlexMediaDescriptionSchema).optional(),
  Genre: z.array(PlexJoinItemSchema).optional(),
  Country: z.array(PlexJoinItemSchema).optional(),
  Director: z.array(PlexJoinItemSchema).optional(),
  Writer: z.array(PlexJoinItemSchema).optional(),
  Role: z.array(PlexJoinItemSchema).optional(),
}).merge(neverDirectory);

export type PlexMovie = z.infer<typeof PlexMovieSchema>;

export const PlexTvShowSchema = BasePlexMediaSchema.extend({
  addedAt: z.number(),
  art: z.string().optional(),
  audienceRating: z.number().optional(),
  audienceRatingImage: z.string().optional(),
  childCount: z.number(),
  Collection: z.array(PlexJoinItemSchema).optional(),
  contentRating: z.string(),
  Country: z.array(PlexJoinItemSchema),
  duration: z.number(),
  Genre: z.array(PlexJoinItemSchema),
  index: z.number(),
  leafCount: z.number(),
  originallyAvailableAt: z.string(),
  primaryExtraKey: z.string(),
  Role: z.array(PlexJoinItemSchema),
  studio: z.string(),
  summary: z.string(),
  tagline: z.string(),
  theme: z.string(),
  thumb: z.string(),
  title: z.string(),
  type: z.literal('show'),
  updatedAt: z.number().optional(),
  viewedLeafCount: z.number(),
  year: z.number(),
}).merge(neverDirectory);

export type PlexTvShow = Alias<z.infer<typeof PlexTvShowSchema>>;

export const PlexTvSeasonSchema = BasePlexMediaSchema.extend({
  parentRatingKey: z.string(),
  parentGuid: z.string(),
  parentStudio: z.string(),
  type: z.literal('season'),
  title: z.string(),
  parentKey: z.string(),
  parentTitle: z.string(),
  summary: z.string(),
  index: z.number(),
  parentIndex: z.number(),
  parentYear: z.number(),
  thumb: z.string(),
  art: z.string(),
  parentThumb: z.string(),
  parentTheme: z.string(),
  leafCount: z.number(),
  viewedLeafCount: z.number(),
  addedAt: z.number(),
  updatedAt: z.number().optional(),
}).merge(neverDirectory);

export type PlexTvSeason = Alias<z.infer<typeof PlexTvSeasonSchema>>;

export const PlexMusicArtistSchema = BasePlexMediaSchema.extend({
  type: z.literal('artist'),
  title: z.string(),
  summary: z.string().optional(),
  index: z.number(),
  viewCount: z.number(),
  skipCount: z.number(),
  lastViewedAt: z.number().optional(),
  thumb: z.string().optional(),
  art: z.string().optional(),
  addedAt: z.number(),
  updatedAt: z.number().optional(),
  Genre: z.array(PlexJoinItemSchema).optional(),
  Country: z.array(PlexJoinItemSchema).optional(),
}).merge(neverDirectory);

export type PlexMusicArtist = Alias<z.infer<typeof PlexMusicArtistSchema>>;

export const PlexMusicAlbumSchema = BasePlexMediaSchema.extend({
  parentRatingKey: z.string(),
  parentGuid: z.string(),
  studio: z.string().optional(),
  type: z.literal('album'),
  title: z.string(),
  parentKey: z.string(), // Artist key
  parentTitle: z.string(), // Artist name
  summary: z.string().optional(),
  index: z.number(),
  viewCount: z.number(),
  skipCount: z.number(),
  lastViewedAt: z.number().optional(),
  year: z.number().optional(),
  thumb: z.string().optional(),
  art: z.string().optional(),
  parentThumb: z.string().optional(),
  originallyAvailableAt: z.string().optional(), // YYYY-mm-dd
  addedAt: z.number(),
  updatedAt: z.number().optional(),
  loudnessAnalysisVersion: z.string().optional(), // "1"
  musicAnalysisVersion: z.string().optional(), // "1"
  Genre: z.array(PlexJoinItemSchema).optional(),
}).merge(neverDirectory);

export type PlexMusicAlbum = Alias<z.infer<typeof PlexMusicAlbumSchema>>;

export const PlexMusicTrackSchema = BasePlexMediaSchema.extend({
  parentRatingKey: z.string(),
  parentGuid: z.string(),
  grandparentGuid: z.string(),
  parentStudio: z.string().optional(),
  type: z.literal('track'),
  title: z.string(),
  grandparentKey: z.string(),
  grandparentRatingKey: z.string(),
  parentKey: z.string(),
  grandparentTitle: z.string(),
  parentTitle: z.string(),
  summary: z.string().optional(),
  index: z.number(),
  parentIndex: z.number(),
  ratingCount: z.number().optional(),
  viewCount: z.number().optional(),
  skipCount: z.number().optional(),
  lastViewedAt: z.number().optional(),
  thumb: z.string().optional(),
  parentYear: z.number().optional(),
  grandparentThumb: z.string().optional(),
  parentThumb: z.string().optional(),
  duration: z.number(),
  addedAt: z.number(),
  updatedAt: z.number().optional(),
  loudnessAnalysisVersion: z.string().optional(), // "1"
  musicAnalysisVersion: z.string().optional(), // "1"
  Media: z.array(PlexMediaDescriptionSchema).optional(),
}).merge(neverDirectory);

export type PlexMusicTrack = Alias<z.infer<typeof PlexMusicTrackSchema>>;

// /library/section/{id}/all for a Movie Library

export const PlexLibraryMoviesSchema = basePlexLibrarySchema.extend({
  Metadata: z.array(PlexMovieSchema),
});

export type PlexLibraryMovies = Alias<z.infer<typeof PlexLibraryMoviesSchema>>;

// /library/sections/{id}/all for a TV library

export const PlexLibraryShowsSchema = makePlexLibraryCollectionsSchema(
  PlexTvShowSchema,
).extend({
  Metadata: z.array(PlexTvShowSchema),
});

export type PlexLibraryShows = Alias<z.infer<typeof PlexLibraryShowsSchema>>;

// /library/sections/{id}/all for a Music Artist

export const PlexLibraryMusicSchema = makePlexLibraryCollectionsSchema(
  PlexMusicArtistSchema,
).extend({
  Metadata: z.array(PlexMusicArtistSchema),
});

export type PlexLibraryMusic = Alias<z.infer<typeof PlexLibraryMusicSchema>>;

// /library/metadata/{id}/children where ID is a TV show
export const PlexSeasonViewSchema = z.object({
  size: z.number(),
  allowSync: z.boolean(),
  art: z.string(),
  identifier: z.string(),
  key: z.string(),
  librarySectionID: z.number(),
  librarySectionTitle: z.string(),
  librarySectionUUID: z.string(),
  mediaTagPrefix: z.string(),
  mediaTagVersion: z.number(),
  nocache: z.boolean(),
  parentIndex: z.number(),
  parentTitle: z.string(),
  parentYear: z.number(),
  summary: z.string(),
  theme: z.string(),
  thumb: z.string(),
  title1: z.string(),
  title2: z.string(),
  viewGroup: z.string(),
  viewMode: z.number(),
  Metadata: z.array(PlexTvSeasonSchema),
});

export type PlexSeasonView = Alias<z.infer<typeof PlexSeasonViewSchema>>;

export const PlexEpisodeSchema = BasePlexMediaSchema.extend({
  addedAt: z.number(),
  art: z.string().optional(),
  audienceRating: z.number().optional(),
  audienceRatingImage: z.string().optional(),
  chapterSource: z.string().optional(),
  contentRating: z.string().optional(),
  duration: z.number(),
  grandparentArt: z.string().optional(),
  grandparentGuid: z.string(),
  grandparentKey: z.string(),
  grandparentRatingKey: z.string(),
  grandparentTheme: z.string().optional(),
  grandparentThumb: z.string().optional(),
  grandparentTitle: z.string(),
  index: z.number().optional(),
  originallyAvailableAt: z.string().optional(),
  parentGuid: z.string(),
  parentIndex: z.number(),
  parentKey: z.string(),
  parentRatingKey: z.string(),
  parentThumb: z.string().optional(),
  parentTitle: z.string(),
  summary: z.string().optional(),
  thumb: z.string().optional(),
  title: z.string(),
  titleSort: z.string().optional(),
  type: z.literal('episode'),
  updatedAt: z.number().optional(),
  year: z.number().optional(),
  Media: z.array(PlexMediaDescriptionSchema).optional(),
  Director: z.array(PlexJoinItemSchema).optional(),
  Writer: z.array(PlexJoinItemSchema).optional(),
  Role: z.array(PlexJoinItemSchema).optional(),
}).merge(neverDirectory);

export type PlexEpisode = Alias<z.infer<typeof PlexEpisodeSchema>>;

// /library/metadata/{id}/children where ID is a TV show season

export const PlexEpisodeViewSchema = basePlexGrandchildCollectionSchema.extend({
  Metadata: z.array(PlexEpisodeSchema),
});

export type PlexEpisodeView = Alias<z.infer<typeof PlexEpisodeViewSchema>>;

// /library/metadata/{id}/children where ID is a music Artist

export const PlexMusicAlbumViewSchema = basePlexChildCollectionSchema.extend({
  Metadata: z.array(PlexMusicAlbumSchema),
});

export type PlexMusicAlbumView = Alias<
  z.infer<typeof PlexMusicAlbumViewSchema>
>;

// /library/metadata/{id}/children where ID is a music album
export const PlexMusicTrackViewSchema =
  basePlexGrandchildCollectionSchema.extend({
    Metadata: z.array(PlexMusicTrackSchema),
  });

export type PlexMusicTrackView = Alias<
  z.infer<typeof PlexMusicTrackViewSchema>
>;

export type PlexLibraryListing =
  | PlexLibraryMovies
  | PlexLibraryShows
  | PlexLibraryMusic;

export function isPlexDirectory(
  item: PlexLibrarySection | PlexMedia | PlexPlaylist | undefined,
): item is PlexLibrarySection {
  return item?.type !== 'playlist' && item?.directory === true;
}

export function isPlexMoviesLibrary(
  lib: PlexLibraryListing,
): lib is PlexLibraryMovies {
  return lib.viewGroup === 'movie';
}

export function isPlexShowLibrary(
  lib: PlexLibraryListing,
): lib is PlexLibraryShows {
  return lib.viewGroup === 'show';
}

export function isPlexMusicLibrary(
  lib: PlexLibraryListing,
): lib is PlexLibraryMusic {
  return lib.viewGroup === 'artist';
}

export function isPlexMediaType<T extends PlexMedia>(discrim: string) {
  return (media: PlexLibrarySection | PlexMedia | undefined): media is T => {
    return !isPlexDirectory(media) && media?.type === discrim;
  };
}

export const isPlexMovie = isPlexMediaType<PlexMovie>('movie');
export const isPlexShow = isPlexMediaType<PlexTvShow>('show');
export const isPlexSeason = isPlexMediaType<PlexTvSeason>('season');
export const isPlexEpisode = isPlexMediaType<PlexEpisode>('episode');
export const isPlexCollection =
  isPlexMediaType<PlexLibraryCollection>('collection');
export const isPlexMusicArtist = isPlexMediaType<PlexMusicArtist>('artist');
export const isPlexMusicAlbum = isPlexMediaType<PlexMusicAlbum>('album');
export const isPlexMusicTrack = isPlexMediaType<PlexMusicTrack>('track');
export const isPlexPlaylist = isPlexMediaType<PlexPlaylist>('playlist');
const funcs = [
  isPlexMovie,
  isPlexShow,
  isPlexSeason,
  isPlexEpisode,
  isPlexCollection,
  isPlexMusicArtist,
  isPlexMusicAlbum,
  isPlexMusicTrack,
  isPlexPlaylist,
];
export const isPlexMedia = (
  media: PlexLibrarySection | PlexMedia | undefined,
): media is PlexMedia => {
  for (const func of funcs) {
    if (func(media)) {
      return true;
    }
  }
  return false;
};

// An item that has children
export function isPlexParentItem(
  item: PlexMedia | PlexLibrarySection,
): item is PlexLibrarySection | PlexParentMediaType {
  return !isTerminalItem(item);
}

export function isTerminalItem(
  item: PlexMedia | PlexLibrarySection,
): item is PlexTerminalMedia {
  return (
    !isPlexDirectory(item) &&
    (isPlexMovie(item) || isPlexEpisode(item) || isPlexMusicTrack(item))
  );
}

// /library/collections/{id}/children
const basePlexCollectionContentsSchema = z.object({
  size: z.number(),
});

export const PlexMovieCollectionContentsSchema =
  basePlexCollectionContentsSchema.extend({
    Metadata: z.array(PlexMovieSchema),
  });

export const PlexTvShowCollectionContentsSchema =
  basePlexCollectionContentsSchema.extend({
    Metadata: z.array(PlexTvShowSchema),
  });

export type PlexMovieCollectionContents = Alias<
  z.infer<typeof PlexMovieCollectionContentsSchema>
>;
export type PlexTvShowCollectionContents = Alias<
  z.infer<typeof PlexTvShowCollectionContentsSchema>
>;

export type PlexCollectionContents =
  | PlexMovieCollectionContents
  | PlexTvShowCollectionContents;

export const PlexMediaSchema = z.discriminatedUnion('type', [
  PlexMovieSchema,
  PlexTvShowSchema,
  PlexTvSeasonSchema,
  PlexEpisodeSchema,
  PlexLibraryCollectionSchema,
  PlexMusicArtistSchema,
  PlexMusicAlbumSchema,
  PlexMusicTrackSchema,
]);

export type PlexMedia = Alias<
  | PlexMovie
  | PlexTvShow
  | PlexTvSeason
  | PlexEpisode
  | PlexLibraryCollection
  | PlexMusicArtist
  | PlexMusicAlbum
  | PlexMusicTrack
  | PlexPlaylist
>;
export type PlexTerminalMedia = PlexMovie | PlexEpisode | PlexMusicTrack; // Media that has no children

// Results you might get by looking up the children of a parent node type
export type PlexChildMediaViewType =
  | PlexSeasonView
  | PlexEpisodeView
  | PlexMusicAlbumView
  | PlexMusicTrackView;

export type PlexParentMediaType =
  | PlexTvShow
  | PlexTvSeason
  | PlexMusicArtist
  | PlexMusicAlbum
  | PlexPlaylist;

type PlexMediaApiChildType = [
  [PlexTvShow, PlexSeasonView],
  [PlexTvSeason, PlexEpisodeView],
  [
    PlexLibraryCollection,
    PlexMovieCollectionContents | PlexTvShowCollectionContents,
  ],
  [PlexMusicArtist, PlexMusicAlbumView],
  [PlexMusicAlbum, PlexMusicTrackView],
];

type PlexMediaToChildType = [
  [PlexTvShow, PlexTvSeason],
  [PlexTvSeason, PlexEpisode],
  [PlexMusicAlbum, PlexMusicArtist],
  [PlexMusicTrack, PlexMusicAlbum],
  [PlexLibraryCollection, PlexMovie | PlexTvShow],
];

export type PlexMetadataType<
  M extends PlexMedia,
  T extends { Metadata: M[] } = { Metadata: M[] },
> = T['Metadata'][0];

type FindChild0<Target, Arr extends unknown[] = []> = Arr extends [
  [infer Head, infer Child],
  ...infer Tail,
]
  ? Head extends Target
    ? Child
    : FindChild0<Target, Tail>
  : never;

export type PlexChildMediaType<Target extends PlexMedia> =
  Target extends PlexTerminalMedia
    ? Target
    : FindChild0<Target, PlexMediaToChildType>;

export type PlexChildMediaApiType<Target extends PlexMedia> = FindChild0<
  Target,
  PlexMediaApiChildType
>;

export const PlexPinsResponseSchema = z.object({
  authToken: z.string().nullable(),
  clientIdentifier: z.string(),
  code: z.string(),
  createdAt: z.string(),
  expiresAt: z.string(),
  expiresIn: z.number(),
  id: z.number(),
  product: z.string(),
  qr: z.string(),
  trusted: z.boolean(),
});

export type PlexPinsResponse = Alias<z.infer<typeof PlexPinsResponseSchema>>;

export const PlexConnectionSchema = z.object({
  IPv6: z.boolean(),
  address: z.string(),
  local: z.boolean(),
  port: z.number(),
  protocol: z.string(),
  relay: z.boolean(),
  uri: z.string(),
});

export type PlexConnection = Alias<z.infer<typeof PlexConnectionSchema>>;

export const PlexResourceSchema = z.object({
  accessToken: z.string(),
  clientIdentifier: z.string(),
  connections: z.array(PlexConnectionSchema),
  createdAt: z.string(),
  device: z.string(),
  dnsRebindingProtection: z.boolean(),
  home: z.boolean(),
  httpsRequired: z.boolean(),
  lastSeenAt: z.string(),
  name: z.string(),
  owned: z.boolean(),
  ownerId: z.string().nullable(),
  platform: z.string(),
  platformVersion: z.string(),
  presence: z.boolean(),
  product: z.string(),
  productVersion: z.string(),
  provides: z.string(),
  publicAddress: z.string(),
  publicAddressMatches: z.boolean(),
  relay: z.boolean(),
  sourceTitle: z.string().nullable(),
  synced: z.boolean(),
});

export type PlexResource = Alias<z.infer<typeof PlexResourceSchema>>;

export const PlexResourcesResponseSchema = z.array(PlexResourceSchema);

export type PlexResourcesResponse = Alias<
  z.infer<typeof PlexResourcesResponseSchema>
>;

export const PlexFilterFieldTypeOperatorSchema = z.object({
  key: z.string(),
  title: z.string(),
});

export const PlexFilterFieldTypeSchema = z.object({
  type: z.string(),
  Operator: z.array(PlexFilterFieldTypeOperatorSchema),
});

export const PlexLibraryFilterSchema = z.object({
  filter: z.string(),
  filterType: z.string(),
  key: z.string(),
  title: z.string(),
  type: z.string(),
  advanced: z.boolean().optional(),
});

export const PlexLibrarySortSchema = z.object({
  active: z.boolean().optional(),
  activeDirection: z.string().optional(),
  default: z.string().optional(),
  defaultDirection: z.string(),
  descKey: z.string(),
  firstCharacterKey: z.string().optional(),
  key: z.string(),
  title: z.string(),
});

export type PlexLibrarySort = z.infer<typeof PlexLibrarySortSchema>;

export const PlexLibraryFieldSchema = z.object({
  key: z.string(),
  title: z.string(),
  type: z.string(),
});

export const PlexFilterTypeSchema = z.object({
  key: z.string(),
  type: PlexMediaTypeSchema,
  title: z.string(),
  active: z.boolean(),
  Filter: z.array(PlexLibraryFilterSchema),
  Sort: z.array(PlexLibrarySortSchema),
  Field: z.array(PlexLibraryFieldSchema),
});

export type PlexFilterType = z.infer<typeof PlexFilterTypeSchema>;

const PlexFilterResponseMetaSchema = z.object({
  Type: z.array(PlexFilterTypeSchema),
  FieldType: z.array(PlexFilterFieldTypeSchema),
});

export type PlexFilterResponseMeta = z.infer<
  typeof PlexFilterResponseMetaSchema
>;

export const PlexFiltersResponseSchema = z.object({
  // There are some standard fields here...
  Meta: PlexFilterResponseMetaSchema,
});

export type PlexFiltersResponse = z.infer<typeof PlexFiltersResponseSchema>;

export const PlexTagSchema = z.object({
  fastKey: z.string().optional(),
  thumb: z.string().optional(),
  key: z.string(),
  title: z.string(),
});

export const PlexTagResultSchema = z.object({
  size: z.number(),
  // Some other stuff here that we don't need yet...
  Directory: z.array(PlexTagSchema),
});

export type PlexTagResult = z.infer<typeof PlexTagResultSchema>;

export const PlexMediaContainerResponseSchema = z.object({
  MediaContainer: z.object({
    size: z.number(),
    // These are only defined if we are querying a library directly
    // and will be omitted if hitting /library/all
    librarySectionID: z.number().optional(),
    librarySectionTitle: z.string().optional(),
    Metadata: z.array(PlexMediaSchema),
  }),
});
