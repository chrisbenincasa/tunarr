import { z } from 'zod';

export const JellyfinUserPolicyResponse = z.object({
  IsAdministrator: z.boolean(),
  IsDisabled: z.boolean(),
  EnableAllFolders: z.boolean(),
});

export type JellyfinUserPolicyResponse = z.infer<
  typeof JellyfinUserPolicyResponse
>;

export const JellyfinUserResponse = z.object({
  Name: z.string(),
  Id: z.string(),
  Policy: JellyfinUserPolicyResponse,
});

export type JellyfinUserResponse = z.infer<typeof JellyfinUserResponse>;

export const JellyfinLibraryPathInfo = z.object({
  Path: z.string(),
  NetworkPath: z.string().optional(),
});

export const JellyfinLibraryOptions = z.object({
  PathInfos: z.array(JellyfinLibraryPathInfo),
});

export const JellyfinLibrary = z.object({
  Name: z.string(),
  CollectionType: z.string(),
  ItemId: z.string(),
  LibraryOptions: JellyfinLibraryOptions,
});

export type JellyfinLibrary = z.infer<typeof JellyfinLibrary>;

export const JellyfinLibraryResponse = z.array(JellyfinLibrary);

export const JellyfinMediaStream = z.object({
  Type: z.string(),
  Codec: z.string(),
  Language: z.string(),
  IsInterlaced: z.boolean().optional(),
  Height: z.number().positive().optional().catch(undefined),
  Width: z.number().positive().optional().catch(undefined),
  Index: z.number(),
  IsDefault: z.boolean(),
  IsForced: z.boolean(),
  IsExternal: z.boolean(),
  IsHearingImpaired: z.boolean().optional(),
  VideoRange: z.string().optional(),
  AudioSpatialFormat: z.string().optional(),
  AspectRatio: z.string().optional(),
  BitRate: z.number().positive().optional(),
  ChannelLayout: z.string().optional(),
  Channels: z.number().positive().optional(),
  RealFrameRate: z.number().positive().optional(),
  PixelFormat: z.string().optional(),
  Title: z.string().optional(),
  Profile: z.string().optional(),
  ColorRange: z.string().optional(),
  ColorSpace: z.string().optional(),
  ColorTransfer: z.string().optional(),
  ColorPrimaries: z.string().optional(),
  IsAnamorphic: z.boolean().optional(),
});

export const JellyfinImageBlurHashes = z.object({
  Backdrop: z.record(z.string()).optional(),
  Primary: z.record(z.string()).optional(),
  Logo: z.record(z.string()).optional(),
  Thumb: z.record(z.string()).optional(),
});

export const JellyfinJoinItem = z.object({
  Name: z.string(),
  Id: z.string(),
});

export const JellyfinPerson = JellyfinJoinItem.extend({
  Role: z.string().optional(),
  Type: z.string().optional(),
  PrimaryImageTag: z.string().optional(),
  ImageBlurHashes: JellyfinImageBlurHashes.optional(),
});

export const JellyfinChapter = z.object({
  StartPositionTicks: z.number().positive(),
  Name: z.string().optional(),
});

export const JellyfinLibraryItem = z.object({
  Name: z.string(),
  Id: z.string(),
  Etag: z.string().optional(),
  // We should always request this
  Path: z.string().optional(),
  OfficialRating: z.string().optional(),
  DateCreated: z.string().optional(),
  CommunityRating: z.number().optional(),
  RunTimeTicks: z.number(),
  Genres: z.array(z.string()).optional(),
  Tags: z.array(z.string()).optional(),
  ProductionYear: z.number().optional(),
  ProviderIds: z.object({
    Imdb: z.string().optional(),
    Tmdb: z.string().optional(),
    TmdbCollection: z.string().optional(),
    Tvdb: z.string().optional(),
  }),
  PremiereDate: z.string().optional(),
  MediaStreams: z.array(JellyfinMediaStream).optional(),
  LocationType: z.string(),
  Overview: z.string(),
  Taglines: z.array(z.string()).optional(),
  Studios: z.array(JellyfinJoinItem).optional(),
  People: z.array(JellyfinPerson).optional(),
  ImageTags: z
    .object({
      Primary: z.string().optional(),
      Logo: z.string().optional(),
      Thumb: z.string().optional(),
    })
    .optional(),
  BackdropImageTags: z.array(z.string()).optional(),
  IndexNumber: z.number().optional(),
  Type: z.string(),
  Chapters: z.array(JellyfinChapter).optional(),
});

export const JellyfinLibraryItemsResponse = z.object({
  Items: z.array(JellyfinLibraryItem),
  TotalRecordCount: z.number(),
  StartIndex: z.number().optional(),
});
