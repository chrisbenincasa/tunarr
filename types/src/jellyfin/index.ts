import { z } from 'zod';

// Some of this is generated from the Jellyfin 10.9.7 OpenAPI Schema

export const JellyfinItemFields = z.enum([
  'AirTime',
  'CanDelete',
  'CanDownload',
  'ChannelInfo',
  'Chapters',
  'Trickplay',
  'ChildCount',
  'CumulativeRunTimeTicks',
  'CustomRating',
  'DateCreated',
  'DateLastMediaAdded',
  'DisplayPreferencesId',
  'Etag',
  'ExternalUrls',
  'Genres',
  'HomePageUrl',
  'ItemCounts',
  'MediaSourceCount',
  'MediaSources',
  'OriginalTitle',
  'Overview',
  'ParentId',
  'Path',
  'People',
  'PlayAccess',
  'ProductionLocations',
  'ProviderIds',
  'PrimaryImageAspectRatio',
  'RecursiveItemCount',
  'Settings',
  'ScreenshotImageTags',
  'SeriesPrimaryImage',
  'SeriesStudio',
  'SortName',
  'SpecialEpisodeNumbers',
  'Studios',
  'Taglines',
  'Tags',
  'RemoteTrailers',
  'MediaStreams',
  'SeasonUserData',
  'ServiceName',
  'ThemeSongIds',
  'ThemeVideoIds',
  'ExternalEtag',
  'PresentationUniqueKey',
  'InheritedParentalRatingValue',
  'ExternalSeriesId',
  'SeriesPresentationUniqueKey',
  'DateLastRefreshed',
  'DateLastSaved',
  'RefreshState',
  'ChannelImage',
  'EnableMediaSourceDisplay',
  'Width',
  'Height',
  'ExtraIds',
  'LocalTrailerCount',
  'IsHD',
  'SpecialFeatureCount',
]);

export const JellyfinBaseItemKind = z.enum([
  'AggregateFolder',
  'Audio',
  'AudioBook',
  'BasePluginFolder',
  'Book',
  'BoxSet',
  'Channel',
  'ChannelFolderItem',
  'CollectionFolder',
  'Episode',
  'Folder',
  'Genre',
  'ManualPlaylistsFolder',
  'Movie',
  'LiveTvChannel',
  'LiveTvProgram',
  'MusicAlbum',
  'MusicArtist',
  'MusicGenre',
  'MusicVideo',
  'Person',
  'Photo',
  'PhotoAlbum',
  'Playlist',
  'PlaylistsFolder',
  'Program',
  'Recording',
  'Season',
  'Series',
  'Studio',
  'Trailer',
  'TvChannel',
  'TvProgram',
  'UserRootFolder',
  'UserView',
  'Video',
  'Year',
]);

export const JellyfinItemFilter = z.enum([
  'IsFolder',
  'IsNotFolder',
  'IsUnplayed',
  'IsPlayed',
  'IsFavorite',
  'IsResumable',
  'Likes',
  'Dislikes',
  'IsFavoriteOrLikes',
]);

export const JellyfinMediaType = z.enum([
  'Unknown',
  'Video',
  'Audio',
  'Photo',
  'Book',
]);

export const JellyfinImageType = z.enum([
  'Primary',
  'Art',
  'Backdrop',
  'Banner',
  'Logo',
  'Thumb',
  'Disc',
  'Box',
  'Screenshot',
  'Menu',
  'Chapter',
  'BoxRear',
  'Profile',
]);

export const JellyfinItemSortBy = z.enum([
  'Default',
  'AiredEpisodeOrder',
  'Album',
  'AlbumArtist',
  'Artist',
  'DateCreated',
  'OfficialRating',
  'DatePlayed',
  'PremiereDate',
  'StartDate',
  'SortName',
  'Name',
  'Random',
  'Runtime',
  'CommunityRating',
  'ProductionYear',
  'PlayCount',
  'CriticRating',
  'IsFolder',
  'IsUnplayed',
  'IsPlayed',
  'SeriesSortName',
  'VideoBitRate',
  'AirTime',
  'Studio',
  'IsFavoriteOrLiked',
  'DateLastContentAdded',
  'SeriesDatePlayed',
  'ParentIndexNumber',
  'IndexNumber',
  'SimilarityScore',
  'SearchScore',
]);

export const JellyfinSortOrder = z.enum(['Ascending', 'Descending']);

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

const JellyfinSessionInfo = z
  .object({
    // PlayState: PlayerStateInfo.nullable(),
    // AdditionalUsers: z.array(SessionUserInfo).nullable(),
    // Capabilities: ClientCapabilities.nullable(),
    RemoteEndPoint: z.string().nullable(),
    PlayableMediaTypes: z.array(JellyfinMediaType).nullable(),
    Id: z.string().nullable(),
    UserId: z.string(),
    UserName: z.string().nullable(),
    Client: z.string().nullable(),
    LastActivityDate: z.string().datetime({ offset: true }),
    LastPlaybackCheckIn: z.string().datetime({ offset: true }),
    LastPausedDate: z.string().datetime({ offset: true }).nullable(),
    DeviceName: z.string().nullable(),
    DeviceType: z.string().nullable(),
    // NowPlayingItem: BaseItemDto.nullable(),
    // NowViewingItem: BaseItemDto.nullable(),
    DeviceId: z.string().nullable(),
    ApplicationVersion: z.string().nullable(),
    // TranscodingInfo: TranscodingInfo.nullable(),
    IsActive: z.boolean(),
    SupportsMediaControl: z.boolean(),
    SupportsRemoteControl: z.boolean(),
    // NowPlayingQueue: z.array(QueueItem).nullable(),
    // NowPlayingQueueFullItems: z.array(BaseItemDto).nullable(),
    HasCustomDeviceName: z.boolean(),
    PlaylistItemId: z.string().nullable(),
    ServerId: z.string().nullable(),
    UserPrimaryImageTag: z.string().nullable(),
    // SupportedCommands: z.array(GeneralCommandType).nullable(),
  })
  .partial();

export const JellyfinUserConfiguration = z
  .object({
    AudioLanguagePreference: z.string().nullable(),
    PlayDefaultAudioTrack: z.boolean(),
    SubtitleLanguagePreference: z.string().nullable(),
    DisplayMissingEpisodes: z.boolean(),
    GroupedFolders: z.array(z.string()),
    // SubtitleMode: SubtitlePlaybackMode,
    DisplayCollectionsView: z.boolean(),
    EnableLocalPassword: z.boolean(),
    OrderedViews: z.array(z.string()),
    LatestItemsExcludes: z.array(z.string()),
    MyMediaExcludes: z.array(z.string()),
    HidePlayedInLatest: z.boolean(),
    RememberAudioSelections: z.boolean(),
    RememberSubtitleSelections: z.boolean(),
    EnableNextEpisodeAutoPlay: z.boolean(),
    CastReceiverId: z.string().nullable(),
  })
  .partial();

export const JellyfinUser = z
  .object({
    Name: z.string().nullable(),
    ServerId: z.string().nullable(),
    ServerName: z.string().nullable(),
    Id: z.string(),
    PrimaryImageTag: z.string().nullable(),
    HasPassword: z.boolean(),
    HasConfiguredPassword: z.boolean(),
    HasConfiguredEasyPassword: z.boolean(),
    EnableAutoLogin: z.boolean().nullable(),
    LastLoginDate: z.string().datetime({ offset: true }).nullable(),
    LastActivityDate: z.string().datetime({ offset: true }).nullable(),
    Configuration: JellyfinUserConfiguration.nullable(),
    // Policy: UserPolicy.nullable(),
    PrimaryImageAspectRatio: z.number().nullable(),
  })
  .partial();

export const JellyfinAuthenticationResult = z
  .object({
    User: JellyfinUser.nullable(),
    SessionInfo: JellyfinSessionInfo.nullable(),
    AccessToken: z.string().nullable(),
    ServerId: z.string().nullable(),
  })
  .partial();
