export * from './dvr.js';
import z from 'zod';
import { PlexWebhookBasePayloadSchema } from './webhooks.js';

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

export const PlexLibrarySectionSchema = z.object({
  allowSync: z.boolean(),
  art: z.string(),
  composite: z.string(),
  filters: z.boolean(),
  refreshing: z.boolean(),
  thumb: z.string(),
  key: z.string(),
  type: z.union([z.literal('movie'), z.literal('show'), z.literal('artist')]),
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
  thumb: z.string(),
  title1: z.string(),
  title2: z.string(),
  viewGroup: z.string(),
  viewMode: z.number(),
});

const basePlexLibrarySchema = basePlexCollectionSchema.extend({
  type: z.union([z.literal('movie'), z.literal('show'), z.literal('artist')]),
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

export const PlexMediaDescriptionSchema = z.object({
  id: z.number(),
  duration: z.number(),
  bitrate: z.number(),
  width: z.number().optional(), // Video only
  height: z.number().optional(), // Video only
  aspectRatio: z.number().optional(), // Video only
  audioChannels: z.number(),
  audioCodec: z.string(),
  videoCodec: z.string().optional(), // Video only
  videoResolution: z.string().optional(), // Video only
  container: z.string(),
  videoFrameRate: z.string().optional(), // Video only
  audioProfile: z.string().optional(),
  videoProfile: z.string().optional(), // Video only
  Part: z.array(
    z.object({
      id: z.number(),
      key: z.string(),
      duration: z.number(),
      file: z.string(),
      size: z.number(),
      audioProfile: z.string().optional(),
      container: z.string(),
      videoProfile: z.string().optional(), // video only
    }),
  ),
});

export type PlexMediaDescription = z.infer<typeof PlexMediaDescriptionSchema>;

export const PlexMovieSchema = z
  .object({
    ratingKey: z.string(),
    key: z.string(),
    guid: z.string(),
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
    originallyAvailableAt: z.string(),
    addedAt: z.number(),
    updatedAt: z.number().optional(),
    audienceRatingImage: z.string().optional(),
    chapterSource: z.string().optional(),
    primaryExtraKey: z.string().optional(),
    ratingImage: z.string().optional(),
    Media: z.array(PlexMediaDescriptionSchema),
    Genre: z.array(PlexJoinItemSchema).optional(),
    Country: z.array(PlexJoinItemSchema).optional(),
    Director: z.array(PlexJoinItemSchema).optional(),
    Writer: z.array(PlexJoinItemSchema).optional(),
    Role: z.array(PlexJoinItemSchema).optional(),
  })
  .merge(neverDirectory);

export type PlexMovie = z.infer<typeof PlexMovieSchema>;

export const PlexTvShowSchema = z
  .object({
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
    guid: z.string(),
    index: z.number(),
    key: z.string(),
    leafCount: z.number(),
    originallyAvailableAt: z.string(),
    primaryExtraKey: z.string(),
    ratingKey: z.string(),
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
  })
  .merge(neverDirectory);

export type PlexTvShow = Alias<z.infer<typeof PlexTvShowSchema>>;

export const PlexTvSeasonSchema = z
  .object({
    ratingKey: z.string(),
    key: z.string(),
    parentRatingKey: z.string(),
    guid: z.string(),
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
  })
  .merge(neverDirectory);

export type PlexTvSeason = Alias<z.infer<typeof PlexTvSeasonSchema>>;

export const PlexMusicArtistSchema = z
  .object({
    ratingKey: z.string(),
    key: z.string(),
    guid: z.string(),
    type: z.literal('artist'),
    title: z.string(),
    sumamry: z.string().optional(),
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
  })
  .merge(neverDirectory);

export type PlexMusicArtist = Alias<z.infer<typeof PlexMusicArtistSchema>>;

export const PlexMusicAlbumSchema = z
  .object({
    ratingKey: z.string(),
    key: z.string(),
    parentRatingKey: z.string(),
    guid: z.string(),
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
  })
  .merge(neverDirectory);

export type PlexMusicAlbum = Alias<z.infer<typeof PlexMusicAlbumSchema>>;

export const PlexMusicTrackSchema = z
  .object({
    ratingKey: z.string(),
    key: z.string(),
    parentRatingKey: z.string(),
    guid: z.string(),
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
    Media: z.array(PlexMediaDescriptionSchema),
  })
  .merge(neverDirectory);

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

export const PlexEpisodeSchema = z
  .object({
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
    guid: z.string(),
    index: z.number(),
    key: z.string(),
    originallyAvailableAt: z.string().optional(),
    parentGuid: z.string(),
    parentIndex: z.number(),
    parentKey: z.string(),
    parentRatingKey: z.string(),
    parentThumb: z.string().optional(),
    parentTitle: z.string(),
    ratingKey: z.string(),
    summary: z.string().optional(),
    thumb: z.string(),
    title: z.string(),
    titleSort: z.string().optional(),
    type: z.literal('episode'),
    updatedAt: z.number().optional(),
    year: z.number().optional(),
    Media: z.array(PlexMediaDescriptionSchema),
    Director: z.array(PlexJoinItemSchema).optional(),
    Writer: z.array(PlexJoinItemSchema).optional(),
    Role: z.array(PlexJoinItemSchema).optional(),
  })
  .merge(neverDirectory);

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
  item: PlexLibrarySection | PlexMedia | undefined,
): item is PlexLibrarySection {
  return item?.directory === true;
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
const funcs = [
  isPlexMovie,
  isPlexShow,
  isPlexSeason,
  isPlexEpisode,
  isPlexCollection,
  isPlexMusicArtist,
  isPlexMusicAlbum,
  isPlexMusicTrack,
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

export function isTerminalItem(
  item: PlexMedia | PlexLibrarySection,
): item is PlexMovie | PlexEpisode {
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
// const PlexMediaSchema = z.discriminatedUnion('type', [
//   PlexMovieSchema,
//   PlexTvShowSchema,
//   PlexTvSeasonSchema,
//   PlexEpisodeSchema,
//   PlexLibraryCollectionSchema,
//   PlexMusicArtistSchema,
//   PlexMusicAlbumSchema,
//   PlexMusicTrackSchema,
// ]);

const PartialPlexMediaSchema = z.discriminatedUnion('type', [
  PlexMovieSchema.partial().required({ type: true }),
  PlexTvShowSchema.partial().required({ type: true }),
  PlexTvSeasonSchema.partial().required({ type: true }),
  PlexEpisodeSchema.partial().required({ type: true }),
  PlexLibraryCollectionSchema.partial().required({ type: true }),
  PlexMusicArtistSchema.partial().required({ type: true }),
  PlexMusicAlbumSchema.partial().required({ type: true }),
  PlexMusicTrackSchema.partial().required({ type: true }),
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
>;
export type PlexTerminalMedia = PlexMovie | PlexEpisode | PlexMusicTrack; // Media that has no children
export type PlexParentMediaType =
  | PlexTvShow
  | PlexTvSeason
  | PlexMusicArtist
  | PlexMusicAlbum;

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
];

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

export * from './webhooks.js';

export const PlexWebhookPayloadSchema = PlexWebhookBasePayloadSchema.extend({
  Metadata: PartialPlexMediaSchema,
});
