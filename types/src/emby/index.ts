import z from 'zod/v4';

export const EmbyCollectionType = z
  .enum([
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
  ])
  .catch('unknown');

export type EmbyCollectionType = z.infer<typeof EmbyCollectionType>;

export const EmbyMediaType = z.enum([
  'Unknown',
  'Video',
  'Audio',
  'Photo',
  'Book',
]);

const EmbyMediaStreamType = z.enum([
  'Unknown',
  'Audio',
  'Video',
  'Subtitle',
  'EmbeddedImage',
  'Attachment',
  'Data',
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
  'Etag',
  'Tags',
  'ProductionYear',
  'PremiereDate',
  'MediaSources',
  'OfficialRating',
]);

const EmbyMediaProtocol = z.enum([
  'File',
  'Http',
  'Rtmp',
  'Rtsp',
  'Udp',
  'Rtp',
  'Ftp',
  'Mms',
]);

const EmbySubtitleDeliveryMethod = z.enum([
  'Encode',
  'Embed',
  'External',
  'Hls',
  'VideoSideData',
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
  'IsFolder',
]);

const EmbyPersonType = z.enum([
  'Actor',
  'Director',
  'Writer',
  'Producer',
  'GuestStar',
  'Composer',
  'Conductor',
  'Lyricist',
]);

export type EmbyItemSortBy = z.infer<typeof EmbyItemSortBy>;

const EmbyMediaUrl = z
  .object({ Url: z.string(), Name: z.string() })
  .partial()
  .loose();

export type EmbyNameIdPair = z.infer<typeof EmbyNameIdPairSchema>;
export const EmbyNameIdPairSchema = z.object({
  Name: z.string().optional(),
  Id: z.string().or(z.number()).optional(),
});

export const EmbyNameLongIdPair = z
  .object({ Name: z.string(), Id: z.number().int() })
  .partial()
  .loose();

const EmbyMarkerType = z.enum([
  'Chapter',
  'IntroStart',
  'IntroEnd',
  'CreditsStart',
]);

export type EmbyChapterInfo = z.infer<typeof EmbyChapterInfoSchema>;

export const EmbyChapterInfoSchema = z
  .object({
    StartPositionTicks: z.number().int(),
    Name: z.string(),
    ImageTag: z.string(),
    MarkerType: EmbyMarkerType,
    ChapterIndex: z.number().int(),
  })
  .partial()
  .loose();

const ExtendedVideoTypes = z.enum([
  'None',
  'Hdr10',
  'Hdr10Plus',
  'HyperLogGamma',
  'DolbyVision',
]);
const ExtendedVideoSubTypes = z.enum([
  'None',
  'Hdr10',
  'HyperLogGamma',
  'Hdr10Plus0',
  'DoviProfile02',
  'DoviProfile10',
  'DoviProfile22',
  'DoviProfile30',
  'DoviProfile42',
  'DoviProfile50',
  'DoviProfile61',
  'DoviProfile76',
  'DoviProfile81',
  'DoviProfile82',
  'DoviProfile83',
  'DoviProfile84',
  'DoviProfile85',
  'DoviProfile92',
]);

const SubtitleLocationType = z.enum(['InternalStream', 'VideoSideData']);

export type EmbyMediaStream = z.infer<typeof EmbyMediaStreamSchema>;

export const EmbyMediaStreamSchema = z
  .object({
    Codec: z.string(),
    CodecTag: z.string(),
    Language: z.string(),
    ColorTransfer: z.string(),
    ColorPrimaries: z.string(),
    ColorSpace: z.string(),
    Comment: z.string(),
    StreamStartTimeTicks: z.number().int().nullable(),
    TimeBase: z.string(),
    Title: z.string(),
    Extradata: z.string(),
    VideoRange: z.string(),
    DisplayTitle: z.string(),
    DisplayLanguage: z.string(),
    NalLengthSize: z.string(),
    IsInterlaced: z.boolean(),
    IsAVC: z.boolean().nullable(),
    ChannelLayout: z.string(),
    BitRate: z.number().int().nullable(),
    BitDepth: z.number().int().nullable(),
    RefFrames: z.number().int().nullable(),
    Rotation: z.number().int().nullable(),
    Channels: z.number().int().nullable(),
    SampleRate: z.number().int().nullable(),
    IsDefault: z.boolean(),
    IsForced: z.boolean(),
    IsHearingImpaired: z.boolean(),
    Height: z.number().int().nullable(),
    Width: z.number().int().nullable(),
    AverageFrameRate: z.number().nullable(),
    RealFrameRate: z.number().nullable(),
    Profile: z.string(),
    Type: EmbyMediaStreamType,
    AspectRatio: z.string(),
    Index: z.number().int(),
    IsExternal: z.boolean(),
    DeliveryMethod: EmbySubtitleDeliveryMethod,
    DeliveryUrl: z.string(),
    IsExternalUrl: z.boolean().nullable(),
    IsTextSubtitleStream: z.boolean(),
    SupportsExternalStream: z.boolean(),
    Path: z.string(),
    Protocol: EmbyMediaProtocol,
    PixelFormat: z.string(),
    Level: z.number().nullable(),
    IsAnamorphic: z.boolean().nullable(),
    ExtendedVideoType: ExtendedVideoTypes,
    ExtendedVideoSubType: ExtendedVideoSubTypes,
    ExtendedVideoSubTypeDescription: z.string(),
    ItemId: z.string(),
    ServerId: z.string(),
    AttachmentSize: z.number().int().nullable(),
    MimeType: z.string(),
    SubtitleLocationType: SubtitleLocationType,
  })
  .partial()
  .loose();

const EmbyMediaSourceType = z.enum(['Default', 'Grouping', 'Placeholder']);

const EmbyVideo3DFormat = z.enum([
  'HalfSideBySide',
  'FullSideBySide',
  'FullTopAndBottom',
  'HalfTopAndBottom',
  'MVC',
]);

const TransportStreamTimestamp = z.enum(['None', 'Zero', 'Valid']);

export type EmbyMediaSourceInfo = z.infer<typeof EmbyMediaSourceInfoSchema>;

export const EmbyMediaSourceInfoSchema = z
  .object({
    Chapters: z.array(EmbyChapterInfoSchema),
    Protocol: EmbyMediaProtocol,
    Id: z.string(),
    Path: z.string(),
    EncoderPath: z.string(),
    EncoderProtocol: EmbyMediaProtocol,
    Type: EmbyMediaSourceType,
    ProbePath: z.string(),
    ProbeProtocol: EmbyMediaProtocol,
    Container: z.string(),
    Size: z.number().int().nullable(),
    Name: z.string(),
    SortName: z.string(),
    IsRemote: z.boolean(),
    HasMixedProtocols: z.boolean(),
    RunTimeTicks: z.number().int().nullable(),
    ContainerStartTimeTicks: z.number().int().nullable(),
    SupportsTranscoding: z.boolean(),
    TrancodeLiveStartIndex: z.number().int().nullable(),
    WallClockStart: z.string().datetime({ offset: true }).nullable(),
    SupportsDirectStream: z.boolean(),
    SupportsDirectPlay: z.boolean(),
    IsInfiniteStream: z.boolean(),
    RequiresOpening: z.boolean(),
    OpenToken: z.string(),
    RequiresClosing: z.boolean(),
    LiveStreamId: z.string(),
    BufferMs: z.number().int().nullable(),
    RequiresLooping: z.boolean(),
    SupportsProbing: z.boolean(),
    Video3DFormat: EmbyVideo3DFormat,
    MediaStreams: z.array(EmbyMediaStreamSchema),
    Formats: z.array(z.string()),
    Bitrate: z.number().int().nullable(),
    Timestamp: TransportStreamTimestamp,
    RequiredHttpHeaders: z.record(z.string(), z.string()),
    DirectStreamUrl: z.string(),
    AddApiKeyToDirectStreamUrl: z.boolean(),
    TranscodingUrl: z.string(),
    TranscodingSubProtocol: z.string(),
    TranscodingContainer: z.string(),
    AnalyzeDurationMs: z.number().int().nullable(),
    ReadAtNativeFramerate: z.boolean(),
    DefaultAudioStreamIndex: z.number().int().nullable(),
    DefaultSubtitleStreamIndex: z.number().int().nullable(),
    ItemId: z.string(),
    ServerId: z.string(),
  })
  .partial()
  .loose();

export type EmbyItem = z.infer<typeof EmbyItemSchema>;

export const EmbyItemSchema = z
  .object({
    // TEMP
    // TODO: REMOVE
    tunarrLibraryId: z.string().optional(),
    Name: z.string(),
    OriginalTitle: z.string(),
    ServerId: z.string(),
    Id: z.string(),
    Guid: z.string(),
    Etag: z.string(),
    Prefix: z.string(),
    TunerName: z.string(),
    PlaylistItemId: z.string(),
    DateCreated: z.iso.datetime({ offset: true }).nullable(),
    ExtraType: z.string(),
    SortIndexNumber: z.number().int().nullable(),
    SortParentIndexNumber: z.number().int().nullable(),
    CanDelete: z.boolean().nullable(),
    CanDownload: z.boolean().nullable(),
    CanEditItems: z.boolean().nullable(),
    SupportsResume: z.boolean().nullable(),
    PresentationUniqueKey: z.string(),
    PreferredMetadataLanguage: z.string(),
    PreferredMetadataCountryCode: z.string(),
    SupportsSync: z.boolean().nullable(),
    SyncStatus: z.enum([
      'Queued',
      'Converting',
      'ReadyToTransfer',
      'Transferring',
      'Synced',
      'Failed',
    ]),
    CanManageAccess: z.boolean().nullable(),
    CanLeaveContent: z.boolean().nullable(),
    CanMakePublic: z.boolean().nullable(),
    Container: z.string(),
    SortName: z.string(),
    ForcedSortName: z.string(),
    Video3DFormat: EmbyVideo3DFormat,
    PremiereDate: z.string().datetime({ offset: true }).nullable(),
    ExternalUrls: z.array(
      z.object({ Name: z.string(), Url: z.string() }).partial().loose(),
    ),
    MediaSources: z.array(EmbyMediaSourceInfoSchema),
    CriticRating: z.number().nullable(),
    GameSystemId: z.number().int().nullable(),
    AsSeries: z.boolean().nullable(),
    GameSystem: z.string(),
    ProductionLocations: z.array(z.string()),
    Path: z.string(),
    OfficialRating: z.string(),
    CustomRating: z.string(),
    ChannelId: z.string(),
    ChannelName: z.string(),
    Overview: z.string(),
    Taglines: z.array(z.string()),
    Genres: z.array(z.string()),
    CommunityRating: z.number().nullable(),
    RunTimeTicks: z.number().int().nullable(),
    Size: z.number().int().nullable(),
    FileName: z.string(),
    Bitrate: z.number().int().nullable(),
    ProductionYear: z.number().int().nullable(),
    Number: z.string(),
    ChannelNumber: z.string(),
    IndexNumber: z.number().int().nullable(),
    IndexNumberEnd: z.number().int().nullable(),
    ParentIndexNumber: z.number().int().nullable(),
    RemoteTrailers: z.array(EmbyMediaUrl),
    ProviderIds: z.record(z.string(), z.string()),
    IsFolder: z.boolean().nullable(),
    ParentId: z.string(),
    Type: EmbyItemKind,
    People: z.array(
      z
        .object({
          Name: z.string(),
          Id: z.string(),
          Role: z.string(),
          Type: EmbyPersonType,
          PrimaryImageTag: z.string(),
        })
        .partial()
        .loose(),
    ),
    Studios: z.array(EmbyNameLongIdPair),
    GenreItems: z.array(EmbyNameLongIdPair),
    TagItems: z.array(EmbyNameLongIdPair),
    ParentLogoItemId: z.string(),
    ParentBackdropItemId: z.string(),
    ParentBackdropImageTags: z.array(z.string()),
    LocalTrailerCount: z.number().int().nullable(),
    UserData: z
      .object({
        Rating: z.number().nullable(),
        PlayedPercentage: z.number().nullable(),
        UnplayedItemCount: z.number().int().nullable(),
        PlaybackPositionTicks: z.number().int(),
        PlayCount: z.number().int().nullable(),
        IsFavorite: z.boolean(),
        LastPlayedDate: z.string().datetime({ offset: true }).nullable(),
        Played: z.boolean(),
        Key: z.string(),
        ItemId: z.string(),
        ServerId: z.string(),
      })
      .partial()
      .loose(),
    RecursiveItemCount: z.number().int().nullable(),
    ChildCount: z.number().int().nullable(),
    SeasonCount: z.number().int().nullable(),
    SeriesName: z.string(),
    SeriesId: z.string(),
    SeasonId: z.string(),
    SpecialFeatureCount: z.number().int().nullable(),
    DisplayPreferencesId: z.string(),
    Status: z.string(),
    AirDays: z.array(
      z.enum([
        'Sunday',
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
      ]),
    ),
    Tags: z.array(z.string()),
    PrimaryImageAspectRatio: z.number().nullable(),
    Artists: z.array(z.string()),
    ArtistItems: z.array(EmbyNameIdPairSchema),
    Composers: z.array(EmbyNameIdPairSchema),
    Album: z.string(),
    CollectionType: z.string(),
    DisplayOrder: z.string(),
    AlbumId: z.string(),
    AlbumPrimaryImageTag: z.string(),
    SeriesPrimaryImageTag: z.string(),
    AlbumArtist: z.string(),
    AlbumArtists: z.array(EmbyNameIdPairSchema),
    SeasonName: z.string(),
    MediaStreams: z.array(EmbyMediaStreamSchema),
    PartCount: z.number().int().nullable(),
    ImageTags: z.record(z.string(), z.string()),
    BackdropImageTags: z.array(z.string()),
    ParentLogoImageTag: z.string(),
    SeriesStudio: z.string(),
    PrimaryImageItemId: z.string(),
    PrimaryImageTag: z.string(),
    ParentThumbItemId: z.string(),
    ParentThumbImageTag: z.string(),
    Chapters: z.array(EmbyChapterInfoSchema),
    LocationType: z.enum(['FileSystem', 'Virtual']),
    MediaType: z.string(),
    EndDate: z.string().datetime({ offset: true }).nullable(),
    LockedFields: z.array(
      z.enum([
        'Cast',
        'Genres',
        'ProductionLocations',
        'Studios',
        'Tags',
        'Name',
        'Overview',
        'Runtime',
        'OfficialRating',
        'Collections',
        'ChannelNumber',
        'SortName',
        'OriginalTitle',
        'SortIndexNumber',
        'SortParentIndexNumber',
        'CommunityRating',
        'CriticRating',
        'Tagline',
        'Composers',
        'Artists',
        'AlbumArtists',
      ]),
    ),
    LockData: z.boolean().nullable(),
    Width: z.number().int().nullable(),
    Height: z.number().int().nullable(),
    CameraMake: z.string(),
    CameraModel: z.string(),
    Software: z.string(),
    ExposureTime: z.number().nullable(),
    FocalLength: z.number().nullable(),
    // ImageOrientation: Drawing_ImageOrientation,
    Aperture: z.number().nullable(),
    ShutterSpeed: z.number().nullable(),
    Latitude: z.number().nullable(),
    Longitude: z.number().nullable(),
    Altitude: z.number().nullable(),
    IsoSpeedRating: z.number().int().nullable(),
    SeriesTimerId: z.string(),
    ChannelPrimaryImageTag: z.string(),
    StartDate: z.string().datetime({ offset: true }).nullable(),
    CompletionPercentage: z.number().nullable(),
    IsRepeat: z.boolean().nullable(),
    IsNew: z.boolean().nullable(),
    EpisodeTitle: z.string(),
    IsMovie: z.boolean().nullable(),
    IsSports: z.boolean().nullable(),
    IsSeries: z.boolean().nullable(),
    IsLive: z.boolean().nullable(),
    IsNews: z.boolean().nullable(),
    IsKids: z.boolean().nullable(),
    IsPremiere: z.boolean().nullable(),
    // TimerType: LiveTv_TimerType,
    Disabled: z.boolean().nullable(),
    ManagementId: z.string(),
    TimerId: z.string(),
    // CurrentProgram: BaseItemDto,
    MovieCount: z.number().int().nullable(),
    SeriesCount: z.number().int().nullable(),
    AlbumCount: z.number().int().nullable(),
    SongCount: z.number().int().nullable(),
    MusicVideoCount: z.number().int().nullable(),
    Subviews: z.array(z.string()),
    ListingsProviderId: z.string(),
    ListingsChannelId: z.string(),
    ListingsPath: z.string(),
    ListingsId: z.string(),
    ListingsChannelName: z.string(),
    ListingsChannelNumber: z.string(),
    AffiliateCallSign: z.string(),
  })
  .partial()
  .required({ Id: true });

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
    Name: z.string(),
    ServerId: z.string(),
    ServerName: z.string(),
    Prefix: z.string(),
    ConnectUserName: z.string(),
    DateCreated: z.string().datetime({ offset: true }).nullable(),
    // ConnectLinkType: Connect_UserLinkType,
    Id: z.string(),
    PrimaryImageTag: z.string(),
    HasPassword: z.boolean(),
    HasConfiguredPassword: z.boolean(),
    EnableAutoLogin: z.boolean().nullable(),
    LastLoginDate: z.string().datetime({ offset: true }).nullable(),
    LastActivityDate: z.string().datetime({ offset: true }).nullable(),
    // Configuration: UserConfiguration,
    Policy: EmbyUserPolicySchema,
    PrimaryImageAspectRatio: z.number().nullable(),
    HasConfiguredEasyPassword: z.boolean(),
    UserItemShareLevel: z.enum([
      'None',
      'Read',
      'Write',
      'Manage',
      'ManageDelete',
    ]),
  })
  .partial()
  .loose();

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
  Locations: z.array(z.string()),
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
