export * from './dvr.js';
import z from 'zod';

type Alias<t> = t & { _?: never };

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
  updatedAt: z.number(),
  createdAt: z.number(),
  scannedAt: z.number(),
  content: z.boolean(),
  directory: z.boolean(),
  contentChangedAt: z.number(),
  hidden: z.number().transform((n) => n === 1),
  Location: z.array(z.object({ id: z.number(), path: z.string() })),
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

export const PlexLibraryCollectionSchema = z.object({
  ratingKey: z.string(),
  key: z.string(),
  guid: z.string(),
  type: z.string(),
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
  updatedAt: z.number(),
  childCount: z.string(),
  collectionSort: z.string().optional(),
  smart: z.string(),
  maxYear: z.string().optional(),
  minYear: z.string().optional(),
});

export type PlexLibraryCollection = z.infer<typeof PlexLibraryCollectionSchema>;

const basePlexLibraryCollectionsSchema = z.object({
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
  type: z.union([z.literal('movie'), z.literal('show'), z.literal('artist')]),
  viewGroup: z.string(),
  viewMode: z.number(),
});

const makePlexLibraryCollectionsSchema = (metadata: z.AnyZodObject) => {
  return basePlexLibraryCollectionsSchema.extend({
    Metadata: z.array(metadata),
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
  width: z.number(),
  height: z.number(),
  aspectRatio: z.number(),
  audioChannels: z.number(),
  audioCodec: z.string(),
  videoCodec: z.string(),
  videoResolution: z.string(),
  container: z.string(),
  videoFrameRate: z.string(),
  audioProfile: z.string().optional(),
  videoProfile: z.string().optional(),
  Part: z.array(
    z.object({
      id: z.number(),
      key: z.string(),
      duration: z.number(),
      file: z.string(),
      size: z.number(),
      audioProfile: z.string().optional(),
      container: z.string(),
      videoProfile: z.string(),
    }),
  ),
});

export type PlexMediaDescription = z.infer<typeof PlexMediaDescriptionSchema>;

// Represents an object that as a tag=>string value
export const PlexJoinItemSchema = z.object({
  tag: z.string(),
});

export type PlexJoinItem = z.infer<typeof PlexJoinItemSchema>;

const neverDirectory = z.object({ directory: z.unknown().optional() });

export const PlexMovieSchema = z
  .object({
    ratingKey: z.string(),
    key: z.string(),
    guid: z.string(),
    editionTitle: z.string(),
    studio: z.string().optional(),
    type: z.literal('movie'),
    title: z.string(),
    titleSort: z.string(),
    contentRating: z.string().optional(),
    summary: z.string().optional(),
    rating: z.number(),
    audienceRating: z.number().optional(),
    year: z.number().optional(),
    tagline: z.string().optional(),
    thumb: z.string(),
    art: z.string().optional(),
    duration: z.number(),
    originallyAvailableAt: z.string(),
    addedAt: z.number(),
    updatedAt: z.number(),
    audienceRatingImage: z.string(),
    chapterSource: z.string(),
    primaryExtraKey: z.string(),
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
    updatedAt: z.number(),
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
    updatedAt: z.number(),
  })
  .merge(neverDirectory);

export type PlexTvSeason = Alias<z.infer<typeof PlexTvSeasonSchema>>;

// /library/section/{id}/all for a Movie Library

export const PlexLibraryMoviesSchema = basePlexLibraryCollectionsSchema.extend({
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
    updatedAt: z.number(),
    year: z.number().optional(),
    Media: z.array(PlexMediaDescriptionSchema),
    Director: z.array(PlexJoinItemSchema).optional(),
    Writer: z.array(PlexJoinItemSchema).optional(),
    Role: z.array(PlexJoinItemSchema).optional(),
  })
  .merge(neverDirectory);

export type PlexEpisode = Alias<z.infer<typeof PlexEpisodeSchema>>;

// /library/metadata/{id}/children where ID is a TV show season

export const PlexEpisodeViewSchema = z.object({
  size: z.number(),
  allowSync: z.boolean(),
  art: z.string(),
  grandparentContentRating: z.string(),
  grandparentRatingKey: z.number(),
  grandparentStudio: z.string(),
  grandparentTheme: z.string(),
  grandparentThumb: z.string(),
  grandparentTitle: z.string(),
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
  theme: z.string(),
  thumb: z.string(),
  title1: z.string(),
  title2: z.string(),
  viewGroup: z.string(),
  viewMode: z.number(),
  Metadata: z.array(PlexEpisodeSchema),
});

export type PlexEpisodeView = Alias<z.infer<typeof PlexEpisodeViewSchema>>;

export type PlexLibraryListing = PlexLibraryMovies | PlexLibraryShows;

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

export type PlexMedia = PlexMovie | PlexTvShow | PlexTvSeason | PlexEpisode;
export type PlexTerminalMedia = PlexMovie | PlexEpisode; // Media that has no children
export type PlexParentMediaType = PlexTvShow | PlexTvSeason;
export type PlexChildType<T> = PlexTvShow extends T
  ? PlexTvSeason
  : PlexTvSeason extends T
  ? PlexEpisode
  : never;

export function isPlexMediaType<T extends PlexMedia>(discrim: string) {
  return (media: PlexLibrarySection | PlexMedia | undefined): media is T => {
    return !isPlexDirectory(media) && media?.type === discrim;
  };
}

export const isPlexMovie = isPlexMediaType<PlexMovie>('movie');
export const isPlexShow = isPlexMediaType<PlexTvShow>('show');
export const isPlexSeason = isPlexMediaType<PlexTvSeason>('season');
export const isPlexEpisode = isPlexMediaType<PlexEpisode>('episode');

export function isTerminalItem(
  item: PlexMedia | PlexLibrarySection,
): item is PlexMovie | PlexEpisode {
  return !isPlexDirectory(item) && (isPlexMovie(item) || isPlexEpisode(item));
}
