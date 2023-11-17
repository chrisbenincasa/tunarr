import z from 'zod';

export const PlexLibrarySectionSchema = z.object({
  allowSync: z.boolean(),
  art: z.string(),
  composite: z.string(),
  filters: z.boolean(),
  refreshing: z.boolean(),
  thumb: z.string(),
  key: z.string(),
  type: z.string(),
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

export type PlexLibrarySection = z.infer<typeof PlexLibrarySectionSchema>;

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
  size: z.number(),
  allowSync: z.boolean(),
  art: z.string(),
  identifier: z.string(),
  librarySectionID: z.number(),
  librarySectionTitle: z.string(),
  librarySectionUUID: z.string(),
  mediaTagPrefix: z.string(),
  mediaTagVersion: z.number(),
  nocache: z.boolean().optional(),
  thumb: z.string(),
  title1: z.string(),
  title2: z.string(),
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
  audioProfile: z.string(),
  videoProfile: z.string(),
  Part: z.array(
    z.object({
      id: z.number(),
      key: z.string(),
      duration: z.number(),
      file: z.string(),
      size: z.number(),
      audioProfile: z.string(),
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

export const PlexMovieSchema = z.object({
  ratingKey: z.string(),
  key: z.string(),
  guid: z.string(),
  editionTitle: z.string(),
  studio: z.string(),
  type: z.string(),
  title: z.string(),
  titleSort: z.string(),
  contentRating: z.string(),
  summary: z.string(),
  rating: z.number(),
  audienceRating: z.number(),
  year: z.number(),
  tagline: z.string(),
  thumb: z.string(),
  art: z.string(),
  duration: z.number(),
  originallyAvailableAt: z.string(),
  addedAt: z.number(),
  updatedAt: z.number(),
  audienceRatingImage: z.string(),
  chapterSource: z.string(),
  primaryExtraKey: z.string(),
  ratingImage: z.string(),
  Media: z.array(PlexMediaDescriptionSchema),
  Genre: z.array(PlexJoinItemSchema).optional(),
  Country: z.array(PlexJoinItemSchema).optional(),
  Director: z.array(PlexJoinItemSchema).optional(),
  Writer: z.array(PlexJoinItemSchema).optional(),
  Role: z.array(PlexJoinItemSchema).optional(),
});

export type PlexMovie = z.infer<typeof PlexMovieSchema>;

export const PlexTvShowSchema = z.object({
  addedAt: z.number(),
  art: z.string(),
  audienceRating: z.number(),
  audienceRatingImage: z.string(),
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
  type: z.string(),
  updatedAt: z.number(),
  viewedLeafCount: z.number(),
  year: z.number(),
});

export type PlexTvShow = z.infer<typeof PlexTvShowSchema>;

export const PlexTvSeasonSchema = z.object({
  ratingKey: z.string(),
  key: z.string(),
  parentRatingKey: z.string(),
  guid: z.string(),
  parentGuid: z.string(),
  parentStudio: z.string(),
  type: z.string(),
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
});

export type PlexTvSeason = z.infer<typeof PlexTvShowSchema>;

// /library/section/{id}/all for a Movie Library

export const PlexLibraryMoviesSchema = basePlexLibraryCollectionsSchema.extend({
  Metadata: z.array(PlexMovieSchema),
});

export type PlexLibraryMovies = z.infer<typeof PlexLibraryMoviesSchema>;

// /library/sections/{id}/all for a TV library

export const PlexTvAllResponseSchema =
  makePlexLibraryCollectionsSchema(PlexTvShowSchema);

export type PlexTvAllResponse = z.infer<typeof PlexTvAllResponseSchema>;

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

export type PlexSeasonView = z.infer<typeof PlexSeasonViewSchema>;

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
  Metadata: z.array(
    z.object({
      addedAt: z.number(),
      art: z.string(),
      audienceRating: z.number(),
      audienceRatingImage: z.string(),
      chapterSource: z.string(),
      contentRating: z.string(),
      duration: z.number(),
      grandparentArt: z.string(),
      grandparentGuid: z.string(),
      grandparentKey: z.string(),
      grandparentRatingKey: z.string(),
      grandparentTheme: z.string(),
      grandparentThumb: z.string(),
      grandparentTitle: z.string(),
      guid: z.string(),
      index: z.number(),
      key: z.string(),
      originallyAvailableAt: z.string(),
      parentGuid: z.string(),
      parentIndex: z.number(),
      parentKey: z.string(),
      parentRatingKey: z.string(),
      parentThumb: z.string(),
      parentTitle: z.string(),
      ratingKey: z.string(),
      summary: z.string(),
      thumb: z.string(),
      title: z.string(),
      titleSort: z.string().optional(),
      type: z.string(),
      updatedAt: z.number(),
      year: z.number(),
      Media: z.array(PlexMediaDescriptionSchema),
      Director: z.array(PlexJoinItemSchema),
      Writer: z.array(PlexJoinItemSchema),
      Role: z.array(PlexJoinItemSchema),
    }),
  ),
});

export type PlexEpisodeView = z.infer<typeof PlexEpisodeViewSchema>;
