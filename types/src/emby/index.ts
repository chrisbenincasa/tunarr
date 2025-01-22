import z from 'zod';

export const EmbyCollectionType = z.enum([
  'unknown',
  'movies',
  'tvshows',
  'music',
  'musicvideos',
  'trailers',
  'homevideos',
  'boxsets',
  'books',
  'photos',
  'livetv',
  'playlists',
  'folders',
]);

export type EmbyCollectionType = z.infer<typeof EmbyCollectionType>;

export const EmbyMediaType = z.enum([
  'Unknown',
  'Video',
  'Audio',
  'Photo',
  'Book',
]);

export const EmbyItemFields = z.enum([
  'Budget',
  'Chapters',
  'ChildCount',
  'DateCreated',
  'Genres',
  'HomePageUrl',
  'IndexOptions',
  'MediaStreams',
  'Overview',
  'ParentId',
  'Path',
  'People',
  'ProviderIds',
  'PrimaryImageAspectRatio',
  'Revenue',
  'SortName',
  'Studios',
  'Taglines',
]);

export type EmbyItemField = z.infer<typeof EmbyItemFields>;

export const EmbyItemKind = z.enum([
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

export type EmbyItemKind = z.infer<typeof EmbyItemKind>;

export const EmbyItemSortBy = z.enum([
  'Album',
  'AlbumArtist',
  'Artist',
  'Budget',
  'CommunityRating',
  'CriticRating',
  'DateCreated',
  'DatePlayed',
  'PlayCount',
  'PremiereDate',
  'ProductionYear',
  'SortName',
  'Random',
  'Revenue',
  'Runtime',
]);

export type EmbyItemSortBy = z.infer<typeof EmbyItemSortBy>;

export type EmbyMediaStream = z.infer<typeof EmbyMediaStreamSchema>;

export const EmbyMediaStreamSchema = z.object({
  Codec: z.string().optional(),
  CodecTag: z.string().optional(),
  Language: z.string().optional(),
  ColorTransfer: z.string().optional(),
  ColorPrimaries: z.string().optional(),
  ColorSpace: z.string().optional(),
  Comment: z.string().optional(),
  TimeBase: z.string().optional(),
  CodecTimeBase: z.string().optional(),
  Title: z.string().optional(),
  Extradata: z.string().optional(),
  VideoRange: z.string().optional(),
  DisplayTitle: z.string().optional(),
  DisplayLanguage: z.string().optional(),
  NalLengthSize: z.string().optional(),
  IsInterlaced: z.boolean().optional(),
  IsAVC: z.boolean().nullish(),
  ChannelLayout: z.string().optional(),
  BitRate: z.number().nullish(),
  BitDepth: z.number().nullish(),
  RefFrames: z.number().nullish(),
  PacketLength: z.number().nullish(),
  Channels: z.number().nullish(),
  SampleRate: z.number().nullish(),
  IsDefault: z.boolean().optional(),
  IsForced: z.boolean().optional(),
  Height: z.number().nullish(),
  Width: z.number().nullish(),
  AverageFrameRate: z.number().nullish(),
  RealFrameRate: z.number().nullish(),
  Profile: z.string().optional(),
  Type: z
    .union([
      z.literal('Audio'),
      z.literal('Video'),
      z.literal('Subtitle'),
      z.literal('EmbeddedImage'),
    ])
    .optional(),
  AspectRatio: z.string().optional(),
  Index: z.number().optional(),
  Score: z.number().nullish(),
  IsExternal: z.boolean().optional(),
  DeliveryMethod: z
    .union([
      z.literal('Encode'),
      z.literal('Embed'),
      z.literal('External'),
      z.literal('Hls'),
    ])
    .optional(),
  DeliveryUrl: z.string().optional(),
  IsExternalUrl: z.boolean().nullish(),
  IsTextSubtitleStream: z.boolean().optional(),
  SupportsExternalStream: z.boolean().optional(),
  Path: z.string().optional(),
  PixelFormat: z.string().optional(),
  Level: z.number().nullish(),
  IsAnamorphic: z.boolean().nullish(),
});

export type EmbyMediaSourceInfo = z.infer<typeof EmbyMediaSourceInfoSchema>;

export const EmbyMediaSourceInfoSchema = z.object({
  Protocol: z
    .enum(['File', 'Http', 'Rtmp', 'Rtsp', 'Udp', 'Rtp', 'Ftp', 'Mms'])
    .optional(),
  Id: z.string().optional(),
  Path: z.string().optional(),
  EncoderPath: z.string().optional(),
  EncoderProtocol: z
    .enum(['File', 'Http', 'Rtmp', 'Rtsp', 'Udp', 'Rtp', 'Ftp', 'Mms'])
    .optional(),
  Type: z
    .union([
      z.literal('Default'),
      z.literal('Grouping'),
      z.literal('Placeholder'),
    ])
    .optional(),
  Container: z.string().optional(),
  Size: z.number().nullish(),
  Name: z.string().optional(),
  IsRemote: z.boolean().optional(),
  RunTimeTicks: z.number().nullish(),
  SupportsTranscoding: z.boolean().optional(),
  SupportsDirectStream: z.boolean().optional(),
  SupportsDirectPlay: z.boolean().optional(),
  IsInfiniteStream: z.boolean().optional(),
  RequiresOpening: z.boolean().optional(),
  OpenToken: z.string().optional(),
  RequiresClosing: z.boolean().optional(),
  LiveStreamId: z.string().optional(),
  BufferMs: z.number().nullish(),
  RequiresLooping: z.boolean().optional(),
  SupportsProbing: z.boolean().optional(),
  Video3DFormat: z
    .union([
      z.literal('HalfSideBySide'),
      z.literal('FullSideBySide'),
      z.literal('FullTopAndBottom'),
      z.literal('HalfTopAndBottom'),
      z.literal('MVC'),
    ])
    .optional(),
  MediaStreams: z.array(EmbyMediaStreamSchema).optional(),
  Formats: z.array(z.string()).optional(),
  Bitrate: z.number().nullish(),
  Timestamp: z
    .union([z.literal('None'), z.literal('Zero'), z.literal('Valid')])
    .optional(),
  RequiredHttpHeaders: z.unknown().optional(),
  TranscodingUrl: z.string().optional(),
  TranscodingSubProtocol: z.string().optional(),
  TranscodingContainer: z.string().optional(),
  AnalyzeDurationMs: z.number().nullish(),
  ReadAtNativeFramerate: z.boolean().optional(),
  DefaultAudioStreamIndex: z.number().nullish(),
  DefaultSubtitleStreamIndex: z.number().nullish(),
});

export type EmbyNameIdPair = z.infer<typeof EmbyNameIdPairSchema>;
export const EmbyNameIdPairSchema = z.object({
  Name: z.string().optional(),
  Id: z.string().or(z.number()).optional(),
});

export type EmbyChapterInfo = z.infer<typeof EmbyChapterInfoSchema>;
export const EmbyChapterInfoSchema = z.object({
  StartPositionTicks: z.number().optional(),
  Name: z.string().optional(),
  ImageTag: z.string().optional(),
});

export type EmbyItem = z.infer<typeof EmbyItemSchema>;

export const EmbyItemSchema = z.object({
  Name: z.string().optional(),
  OriginalTitle: z.string().optional(),
  ServerId: z.string().optional(),
  Id: z.string(),
  Etag: z.string().optional(),
  PlaylistItemId: z.string().optional(),
  DateCreated: z.string().nullish(),
  ExtraType: z.string().optional(),
  AirsBeforeSeasonNumber: z.number().nullish(),
  AirsAfterSeasonNumber: z.number().nullish(),
  AirsBeforeEpisodeNumber: z.number().nullish(),
  DisplaySpecialsWithSeasons: z.boolean().nullish(),
  CanDelete: z.boolean().nullish(),
  CanDownload: z.boolean().nullish(),
  HasSubtitles: z.boolean().nullish(),
  SupportsResume: z.boolean().nullish(),
  PreferredMetadataLanguage: z.string().optional(),
  PreferredMetadataCountryCode: z.string().optional(),
  SupportsSync: z.boolean().nullish(),
  Container: z.string().optional(),
  SortName: z.string().optional(),
  ForcedSortName: z.string().optional(),
  Video3DFormat: z
    .union([
      z.literal('HalfSideBySide'),
      z.literal('FullSideBySide'),
      z.literal('FullTopAndBottom'),
      z.literal('HalfTopAndBottom'),
      z.literal('MVC'),
    ])
    .optional(),
  PremiereDate: z.string().nullish(),
  // ExternalUrls: z.array(ExternalUrl).optional(),
  MediaSources: z.array(EmbyMediaSourceInfoSchema).optional(),
  CriticRating: z.number().nullish(),
  GameSystemId: z.number().nullish(),
  GameSystem: z.string().optional(),
  ProductionLocations: z.array(z.string()).optional(),
  Path: z.string().optional(),
  OfficialRating: z.string().optional(),
  CustomRating: z.string().optional(),
  ChannelId: z.string().optional(),
  ChannelName: z.string().optional(),
  Overview: z.string().optional(),
  Taglines: z.array(z.string()).optional(),
  Genres: z.array(z.string()).optional(),
  CommunityRating: z.number().nullish(),
  RunTimeTicks: z.number().nullish(),
  PlayAccess: z.union([z.literal('Full'), z.literal('None')]).optional(),
  AspectRatio: z.string().optional(),
  ProductionYear: z.number().nullish(),
  Number: z.string().optional(),
  ChannelNumber: z.string().optional(),
  IndexNumber: z.number().nullish(),
  IndexNumberEnd: z.number().nullish(),
  ParentIndexNumber: z.number().nullish(),
  // RemoteTrailers: z.array(MediaUrl).optional(),
  ProviderIds: z.record(z.string()).optional(),
  IsFolder: z.boolean().nullish(),
  ParentId: z.string().optional(),
  Type: EmbyItemKind.optional(),
  // People: z.array(BaseItemPerson).optional(),
  Studios: z.array(EmbyNameIdPairSchema).optional(),
  GenreItems: z.array(EmbyNameIdPairSchema).optional(),
  ParentLogoItemId: z.string().optional(),
  ParentBackdropItemId: z.string().optional(),
  ParentBackdropImageTags: z.array(z.string()).optional(),
  LocalTrailerCount: z.number().nullish(),
  // UserData: UserItemDataDto.optional(),
  RecursiveItemCount: z.number().nullish(),
  ChildCount: z.number().nullish(),
  SeriesName: z.string().optional(),
  SeriesId: z.string().optional(),
  SeasonId: z.string().optional(),
  SpecialFeatureCount: z.number().nullish(),
  DisplayPreferencesId: z.string().optional(),
  Status: z.string().optional(),
  AirTime: z.string().optional(),
  AirDays: z
    .array(
      z.union([
        z.literal('Sunday'),
        z.literal('Monday'),
        z.literal('Tuesday'),
        z.literal('Wednesday'),
        z.literal('Thursday'),
        z.literal('Friday'),
        z.literal('Saturday'),
      ]),
    )
    .optional(),
  Tags: z.array(z.string()).optional(),
  PrimaryImageAspectRatio: z.number().nullish(),
  Artists: z.array(z.string()).optional(),
  ArtistItems: z.array(EmbyNameIdPairSchema).optional(),
  Album: z.string().optional(),
  CollectionType: z.string().optional(),
  DisplayOrder: z.string().optional(),
  AlbumId: z.string().optional(),
  AlbumPrimaryImageTag: z.string().optional(),
  SeriesPrimaryImageTag: z.string().optional(),
  AlbumArtist: z.string().optional(),
  AlbumArtists: z.array(EmbyNameIdPairSchema).optional(),
  SeasonName: z.string().optional(),
  MediaStreams: z.array(EmbyMediaStreamSchema).optional(),
  PartCount: z.number().nullish(),
  ImageTags: z.record(z.string()).optional(),
  BackdropImageTags: z.array(z.string()).optional(),
  ParentLogoImageTag: z.string().optional(),
  ParentArtItemId: z.string().optional(),
  ParentArtImageTag: z.string().optional(),
  SeriesThumbImageTag: z.string().optional(),
  SeriesStudio: z.string().optional(),
  ParentThumbItemId: z.string().optional(),
  ParentThumbImageTag: z.string().optional(),
  ParentPrimaryImageItemId: z.string().optional(),
  ParentPrimaryImageTag: z.string().optional(),
  Chapters: z.array(EmbyChapterInfoSchema).optional(),
  LocationType: z
    .union([z.literal('FileSystem'), z.literal('Virtual')])
    .optional(),
  MediaType: z.string().optional(),
  EndDate: z.string().nullish(),
  LockedFields: z
    .array(
      z.union([
        z.literal('Cast'),
        z.literal('Genres'),
        z.literal('ProductionLocations'),
        z.literal('Studios'),
        z.literal('Tags'),
        z.literal('Name'),
        z.literal('Overview'),
        z.literal('Runtime'),
        z.literal('OfficialRating'),
      ]),
    )
    .optional(),
  LockData: z.boolean().nullish(),
  Width: z.number().nullish(),
  Height: z.number().nullish(),
  CameraMake: z.string().optional(),
  CameraModel: z.string().optional(),
  Software: z.string().optional(),
  ExposureTime: z.number().nullish(),
  FocalLength: z.number().nullish(),
  ImageOrientation: z
    .union([
      z.literal('TopLeft'),
      z.literal('TopRight'),
      z.literal('BottomRight'),
      z.literal('BottomLeft'),
      z.literal('LeftTop'),
      z.literal('RightTop'),
      z.literal('RightBottom'),
      z.literal('LeftBottom'),
    ])
    .optional(),
  Aperture: z.number().nullish(),
  ShutterSpeed: z.number().nullish(),
  Latitude: z.number().nullish(),
  Longitude: z.number().nullish(),
  Altitude: z.number().nullish(),
  IsoSpeedRating: z.number().nullish(),
  SeriesTimerId: z.string().optional(),
  ChannelPrimaryImageTag: z.string().optional(),
  StartDate: z.string().nullish(),
  CompletionPercentage: z.number().nullish(),
  IsRepeat: z.boolean().nullish(),
  IsNew: z.boolean().nullish(),
  EpisodeTitle: z.string().optional(),
  IsMovie: z.boolean().nullish(),
  IsSports: z.boolean().nullish(),
  IsSeries: z.boolean().nullish(),
  IsLive: z.boolean().nullish(),
  IsNews: z.boolean().nullish(),
  IsKids: z.boolean().nullish(),
  IsPremiere: z.boolean().nullish(),
  TimerId: z.string().optional(),
  // CurrentProgram: EmbyItemSchema.optional(),
  MovieCount: z.number().nullish(),
  SeriesCount: z.number().nullish(),
  AlbumCount: z.number().nullish(),
  SongCount: z.number().nullish(),
  MusicVideoCount: z.number().nullish(),
});

const EmbyUserPolicySchema = z.object({
  IsAdministrator: z.boolean().optional(),
  IsHidden: z.boolean().optional(),
  IsHiddenRemotely: z.boolean().optional(),
  IsDisabled: z.boolean().optional(),
  MaxParentalRating: z.number().nullish(),
  BlockedTags: z.array(z.string()).optional(),
  EnableUserPreferenceAccess: z.boolean().optional(),
  // AccessSchedules: z.array(Configuration_AccessSchedule).optional(),
  BlockUnratedItems: z
    .array(
      z.union([
        z.literal('Movie'),
        z.literal('Trailer'),
        z.literal('Series'),
        z.literal('Music'),
        z.literal('Game'),
        z.literal('Book'),
        z.literal('LiveTvChannel'),
        z.literal('LiveTvProgram'),
        z.literal('ChannelContent'),
        z.literal('Other'),
      ]),
    )
    .optional(),
  EnableRemoteControlOfOtherUsers: z.boolean().optional(),
  EnableSharedDeviceControl: z.boolean().optional(),
  EnableRemoteAccess: z.boolean().optional(),
  EnableLiveTvManagement: z.boolean().optional(),
  EnableLiveTvAccess: z.boolean().optional(),
  EnableMediaPlayback: z.boolean().optional(),
  EnableAudioPlaybackTranscoding: z.boolean().optional(),
  EnableVideoPlaybackTranscoding: z.boolean().optional(),
  EnablePlaybackRemuxing: z.boolean().optional(),
  EnableContentDeletion: z.boolean().optional(),
  EnableContentDeletionFromFolders: z.array(z.string()).optional(),
  EnableContentDownloading: z.boolean().optional(),
  EnableSubtitleDownloading: z.boolean().optional(),
  EnableSubtitleManagement: z.boolean().optional(),
  EnableSyncTranscoding: z.boolean().optional(),
  EnableMediaConversion: z.boolean().optional(),
  EnabledDevices: z.array(z.string()).optional(),
  EnableAllDevices: z.boolean().optional(),
  EnabledChannels: z.array(z.string()).optional(),
  EnableAllChannels: z.boolean().optional(),
  EnabledFolders: z.array(z.string()).optional(),
  EnableAllFolders: z.boolean().optional(),
  InvalidLoginAttemptCount: z.number().optional(),
  EnablePublicSharing: z.boolean().optional(),
  BlockedMediaFolders: z.array(z.string()).optional(),
  BlockedChannels: z.array(z.string()).optional(),
  RemoteClientBitrateLimit: z.number().optional(),
  AuthenticationProviderId: z.string().optional(),
  ExcludedSubFolders: z.array(z.string()).optional(),
  DisablePremiumFeatures: z.boolean().optional(),
});

export const EmbyUserSchema = z
  .object({
    Name: z.string().nullable().optional(),
    ServerId: z.string().nullable().optional(),
    ServerName: z.string().nullable().optional(),
    Id: z.string(),
    PrimaryImageTag: z.string().nullable().optional(),
    HasPassword: z.boolean(),
    HasConfiguredPassword: z.boolean(),
    HasConfiguredEasyPassword: z.boolean(),
    EnableAutoLogin: z.boolean().nullable().optional(),
    LastLoginDate: z.string().datetime({ offset: true }).nullable().optional(),
    LastActivityDate: z
      .string()
      .datetime({ offset: true })
      .nullable()
      .optional(),
    // Configuration: EmbyUserConfiguration.nullable().optional(),
    Policy: EmbyUserPolicySchema.nullable().optional(),
    PrimaryImageAspectRatio: z.number().nullable().optional(),
  })
  .partial();

const EmbySessionInfoSchema = z
  .object({
    // PlayState: PlayerStateInfo.nullable().optional(),
    // AdditionalUsers: z.array(SessionUserInfo).nullable().optional(),
    // Capabilities: ClientCapabilities.nullable().optional(),
    RemoteEndPoint: z.string().nullable().optional(),
    PlayableMediaTypes: z.array(EmbyMediaType).nullable().optional(),
    Id: z.string().nullable().optional(),
    UserId: z.string(),
    UserName: z.string().nullable().optional(),
    Client: z.string().nullable().optional(),
    LastActivityDate: z.string().datetime({ offset: true }),
    LastPlaybackCheckIn: z.string().datetime({ offset: true }),
    LastPausedDate: z.string().datetime({ offset: true }).nullable().optional(),
    DeviceName: z.string().nullable().optional(),
    DeviceType: z.string().nullable().optional(),
    // NowPlayingItem: BaseItemDto.nullable().optional(),
    // NowViewingItem: BaseItemDto.nullable().optional(),
    DeviceId: z.string().nullable().optional(),
    ApplicationVersion: z.string().nullable().optional(),
    // TranscodingInfo: TranscodingInfo.nullable().optional(),
    IsActive: z.boolean(),
    SupportsMediaControl: z.boolean(),
    SupportsRemoteControl: z.boolean(),
    // NowPlayingQueue: z.array(QueueItem).nullable().optional(),
    // NowPlayingQueueFullItems: z.array(BaseItemDto).nullable().optional(),
    HasCustomDeviceName: z.boolean(),
    PlaylistItemId: z.string().nullable().optional(),
    ServerId: z.string().nullable().optional(),
    UserPrimaryImageTag: z.string().nullable().optional(),
    // SupportedCommands: z.array(GeneralCommandType).nullable().optional(),
  })
  .partial();

export const EmbyAuthenticationResultSchema = z
  .object({
    User: EmbyUserSchema.nullable().optional(),
    SessionInfo: EmbySessionInfoSchema.nullable().optional(),
    AccessToken: z.string().nullable().optional(),
    ServerId: z.string().nullable().optional(),
  })
  .partial();

export const EmbyLibraryItemsResponse = z.object({
  Items: z.array(EmbyItemSchema),
  TotalRecordCount: z.number(),
  StartIndex: z.number().nullable().optional(),
});

export type EmbyLibraryItemsResponse = z.infer<typeof EmbyLibraryItemsResponse>;

export type EmbySystemInfo = z.infer<typeof EmbySystemInfo>;
export const EmbySystemInfo = z.object({
  SystemUpdateLevel: z.enum(['Release', 'Beta', 'Dev']).optional(),
  OperatingSystemDisplayName: z.string().optional(),
  PackageName: z.string().optional(),
  HasPendingRestart: z.boolean().optional(),
  IsShuttingDown: z.boolean().optional(),
  SupportsLibraryMonitor: z.boolean().optional(),
  WebSocketPortNumber: z.number().optional(),
  // CompletedInstallations: z.array(Updates_InstallationInfo).optional(),
  CanSelfRestart: z.boolean().optional(),
  CanSelfUpdate: z.boolean().optional(),
  CanLaunchWebBrowser: z.boolean().optional(),
  ProgramDataPath: z.string().optional(),
  ItemsByNamePath: z.string().optional(),
  CachePath: z.string().optional(),
  LogPath: z.string().optional(),
  InternalMetadataPath: z.string().optional(),
  TranscodingTempPath: z.string().optional(),
  HttpServerPortNumber: z.number().optional(),
  SupportsHttps: z.boolean().optional(),
  HttpsPortNumber: z.number().optional(),
  HasUpdateAvailable: z.boolean().optional(),
  SupportsAutoRunAtStartup: z.boolean().optional(),
  HardwareAccelerationRequiresPremiere: z.boolean().optional(),
  LocalAddress: z.string().optional(),
  WanAddress: z.string().optional(),
  ServerName: z.string().optional(),
  Version: z.string().optional(),
  OperatingSystem: z.string().optional(),
  Id: z.string().optional(),
});

export const EmbyLibraryPathInfo = z.object({
  Path: z.string(),
  NetworkPath: z.string().nullable().optional(),
});

export const EmbyLibraryOptions = z.object({
  PathInfos: z.array(EmbyLibraryPathInfo),
});

export const EmbyLibrary = z.object({
  Name: z.string(),
  CollectionType: EmbyCollectionType,
  ItemId: z.string(),
  LibraryOptions: EmbyLibraryOptions,
});

export type EmbyLibrary = z.infer<typeof EmbyLibrary>;

export const EmbyLibraryResponse = z.array(EmbyLibrary);

export function isTerminalEmbyItem(item: EmbyItem): boolean {
  if (!item.Type) {
    return false;
  }

  return [
    'Movie',
    'Episode',
    'Audio',
    'Video',
    'Trailer',
    'MusicVideo',
  ].includes(item.Type);
}

export function isEmbyType(item: EmbyItem, types: EmbyItemKind[]): boolean {
  if (!item.Type) {
    return false;
  }

  return types.includes(item.Type);
}
