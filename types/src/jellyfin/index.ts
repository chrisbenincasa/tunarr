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

const CollectionType = z.enum([
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

export const JellyfinSortOrder = z.enum(['Ascending', 'Descending']);

const ChapterInfo = z
  .object({
    StartPositionTicks: z.number().int(),
    Name: z.string().nullable(),
    ImagePath: z.string().nullable(),
    ImageDateModified: z.string().datetime({ offset: true }),
    ImageTag: z.string().nullable(),
  })
  .partial();

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

type Video3DFormat =
  | 'HalfSideBySide'
  | 'FullSideBySide'
  | 'FullTopAndBottom'
  | 'HalfTopAndBottom'
  | 'MVC';
type ExternalUrl = Partial<{
  Name: string | null;
  Url: string | null;
}>;

type MediaProtocol = 'File' | 'Http' | 'Rtmp' | 'Rtsp' | 'Udp' | 'Rtp' | 'Ftp';
type MediaSourceType = 'Default' | 'Grouping' | 'Placeholder';
type VideoType = 'VideoFile' | 'Iso' | 'Dvd' | 'BluRay';
type IsoType = 'Dvd' | 'BluRay';

type VideoRange = 'Unknown' | 'SDR' | 'HDR';

type VideoRangeType =
  | 'Unknown'
  | 'SDR'
  | 'HDR10'
  | 'HLG'
  | 'DOVI'
  | 'DOVIWithHDR10'
  | 'DOVIWithHLG'
  | 'DOVIWithSDR'
  | 'HDR10Plus';

type MediaStreamType =
  | 'Audio'
  | 'Video'
  | 'Subtitle'
  | 'EmbeddedImage'
  | 'Data'
  | 'Lyric';

type SubtitleDeliveryMethod = 'Encode' | 'Embed' | 'External' | 'Hls' | 'Drop';

const BaseItemKind = z.enum([
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

type BaseItemKind = z.infer<typeof BaseItemKind>;

export type PersonKind =
  | 'Unknown'
  | 'Actor'
  | 'Director'
  | 'Composer'
  | 'Writer'
  | 'GuestStar'
  | 'Producer'
  | 'Conductor'
  | 'Lyricist'
  | 'Arranger'
  | 'Engineer'
  | 'Mixer'
  | 'Remixer'
  | 'Creator'
  | 'Artist'
  | 'AlbumArtist'
  | 'Author'
  | 'Illustrator'
  | 'Penciller'
  | 'Inker'
  | 'Colorist'
  | 'Letterer'
  | 'CoverArtist'
  | 'Editor'
  | 'Translator';

const NameGuidPair = z
  .object({ Name: z.string().nullable(), Id: z.string().uuid() })
  .partial();

type NameGuidPair = z.infer<typeof NameGuidPair>;

type CollectionType =
  | 'unknown'
  | 'movies'
  | 'tvshows'
  | 'music'
  | 'musicvideos'
  | 'trailers'
  | 'homevideos'
  | 'boxsets'
  | 'books'
  | 'photos'
  | 'livetv'
  | 'playlists'
  | 'folders';

type ChapterInfo = Partial<{
  StartPositionTicks: number;
  Name: string | null;
  ImagePath: string | null;
  ImageDateModified: string;
  ImageTag: string | null;
}>;

const ExtraType = z.enum([
  'Unknown',
  'Clip',
  'Trailer',
  'BehindTheScenes',
  'DeletedScene',
  'Interview',
  'Scene',
  'Sample',
  'ThemeSong',
  'ThemeVideo',
  'Featurette',
  'Short',
]);

const Video3DFormat = z.enum([
  'HalfSideBySide',
  'FullSideBySide',
  'FullTopAndBottom',
  'HalfTopAndBottom',
  'MVC',
]);
const ExternalUrl = z
  .object({ Name: z.string().nullable(), Url: z.string().nullable() })
  .partial();
const MediaProtocol = z.enum([
  'File',
  'Http',
  'Rtmp',
  'Rtsp',
  'Udp',
  'Rtp',
  'Ftp',
]);
const MediaSourceType = z.enum(['Default', 'Grouping', 'Placeholder']);
const VideoType = z.enum(['VideoFile', 'Iso', 'Dvd', 'BluRay']);
const IsoType = z.enum(['Dvd', 'BluRay']);
const VideoRange = z.enum(['Unknown', 'SDR', 'HDR']);
const VideoRangeType = z.enum([
  'Unknown',
  'SDR',
  'HDR10',
  'HLG',
  'DOVI',
  'DOVIWithHDR10',
  'DOVIWithHLG',
  'DOVIWithSDR',
  'HDR10Plus',
]);

const SubtitleDeliveryMethod = z.enum([
  'Encode',
  'Embed',
  'External',
  'Hls',
  'Drop',
]);

const MediaStreamType = z.enum([
  'Audio',
  'Video',
  'Subtitle',
  'EmbeddedImage',
  'Data',
  'Lyric',
]);

const MediaAttachment = z
  .object({
    Codec: z.string().nullable(),
    CodecTag: z.string().nullable(),
    Comment: z.string().nullable(),
    Index: z.number().int(),
    FileName: z.string().nullable(),
    MimeType: z.string().nullable(),
    DeliveryUrl: z.string().nullable(),
  })
  .partial();

const MediaStream = z
  .object({
    Codec: z.string().nullable(),
    CodecTag: z.string().nullable(),
    Language: z.string().nullable(),
    ColorRange: z.string().nullable(),
    ColorSpace: z.string().nullable(),
    ColorTransfer: z.string().nullable(),
    ColorPrimaries: z.string().nullable(),
    DvVersionMajor: z.number().int().nullable(),
    DvVersionMinor: z.number().int().nullable(),
    DvProfile: z.number().int().nullable(),
    DvLevel: z.number().int().nullable(),
    RpuPresentFlag: z.number().int().nullable(),
    ElPresentFlag: z.number().int().nullable(),
    BlPresentFlag: z.number().int().nullable(),
    DvBlSignalCompatibilityId: z.number().int().nullable(),
    Comment: z.string().nullable(),
    TimeBase: z.string().nullable(),
    CodecTimeBase: z.string().nullable(),
    Title: z.string().nullable(),
    VideoRange: VideoRange,
    VideoRangeType: VideoRangeType,
    VideoDoViTitle: z.string().nullable(),
    // AudioSpatialFormat: AudioSpatialFormat.default('None'),
    LocalizedUndefined: z.string().nullable(),
    LocalizedDefault: z.string().nullable(),
    LocalizedForced: z.string().nullable(),
    LocalizedExternal: z.string().nullable(),
    LocalizedHearingImpaired: z.string().nullable(),
    DisplayTitle: z.string().nullable(),
    NalLengthSize: z.string().nullable(),
    IsInterlaced: z.boolean(),
    IsAVC: z.boolean().nullable(),
    ChannelLayout: z.string().nullable(),
    BitRate: z.number().int().nullable(),
    BitDepth: z.number().int().nullable(),
    RefFrames: z.number().int().nullable(),
    PacketLength: z.number().int().nullable(),
    Channels: z.number().int().nullable(),
    SampleRate: z.number().int().nullable(),
    IsDefault: z.boolean(),
    IsForced: z.boolean(),
    IsHearingImpaired: z.boolean(),
    Height: z.number().int().nullable(),
    Width: z.number().int().nullable(),
    AverageFrameRate: z.number().nullable(),
    RealFrameRate: z.number().nullable(),
    Profile: z.string().nullable(),
    Type: MediaStreamType,
    AspectRatio: z.string().nullable(),
    Index: z.number().int(),
    Score: z.number().int().nullable(),
    IsExternal: z.boolean(),
    DeliveryMethod: SubtitleDeliveryMethod.nullable(),
    DeliveryUrl: z.string().nullable(),
    IsExternalUrl: z.boolean().nullable(),
    IsTextSubtitleStream: z.boolean(),
    SupportsExternalStream: z.boolean(),
    Path: z.string().nullable(),
    PixelFormat: z.string().nullable(),
    Level: z.number().nullable(),
    IsAnamorphic: z.boolean().nullable(),
  })
  .partial();

const MediaSourceInfo = z
  .object({
    Protocol: MediaProtocol,
    Id: z.string().nullable(),
    Path: z.string().nullable(),
    EncoderPath: z.string().nullable(),
    EncoderProtocol: MediaProtocol.nullable(),
    Type: MediaSourceType,
    Container: z.string().nullable(),
    Size: z.number().int().nullable(),
    Name: z.string().nullable(),
    IsRemote: z.boolean(),
    ETag: z.string().nullable(),
    RunTimeTicks: z.number().int().nullable(),
    ReadAtNativeFramerate: z.boolean(),
    IgnoreDts: z.boolean(),
    IgnoreIndex: z.boolean(),
    GenPtsInput: z.boolean(),
    SupportsTranscoding: z.boolean(),
    SupportsDirectStream: z.boolean(),
    SupportsDirectPlay: z.boolean(),
    IsInfiniteStream: z.boolean(),
    RequiresOpening: z.boolean(),
    OpenToken: z.string().nullable(),
    RequiresClosing: z.boolean(),
    LiveStreamId: z.string().nullable(),
    BufferMs: z.number().int().nullable(),
    RequiresLooping: z.boolean(),
    SupportsProbing: z.boolean(),
    VideoType: VideoType.nullable(),
    IsoType: IsoType.nullable(),
    Video3DFormat: Video3DFormat.nullable(),
    MediaStreams: z.array(MediaStream).nullable(),
    MediaAttachments: z.array(MediaAttachment).nullable(),
    Formats: z.array(z.string()).nullable(),
    Bitrate: z.number().int().nullable(),
    // Timestamp: TransportStreamTimestamp.nullable(),
    RequiredHttpHeaders: z.record(z.string().nullable()).nullable(),
    TranscodingUrl: z.string().nullable(),
    // TranscodingSubProtocol: MediaStreamProtocol,
    TranscodingContainer: z.string().nullable(),
    AnalyzeDurationMs: z.number().int().nullable(),
    DefaultAudioStreamIndex: z.number().int().nullable(),
    DefaultSubtitleStreamIndex: z.number().int().nullable(),
  })
  .partial();

const JellyfinBaseItemSchema = z.object({
  Name: z.string().nullable(),
  OriginalTitle: z.string().nullable(),
  ServerId: z.string().nullable(),
  Id: z.string().uuid(),
  Etag: z.string().nullable(),
  SourceType: z.string().nullable(),
  PlaylistItemId: z.string().nullable(),
  DateCreated: z.string().datetime({ offset: true }).nullable(),
  DateLastMediaAdded: z.string().datetime({ offset: true }).nullable(),
  ExtraType: ExtraType.nullable(),
  AirsBeforeSeasonNumber: z.number().int().nullable(),
  AirsAfterSeasonNumber: z.number().int().nullable(),
  AirsBeforeEpisodeNumber: z.number().int().nullable(),
  CanDelete: z.boolean().nullable(),
  CanDownload: z.boolean().nullable(),
  HasLyrics: z.boolean().nullable(),
  HasSubtitles: z.boolean().nullable(),
  PreferredMetadataLanguage: z.string().nullable(),
  PreferredMetadataCountryCode: z.string().nullable(),
  Container: z.string().nullable(),
  SortName: z.string().nullable(),
  ForcedSortName: z.string().nullable(),
  Video3DFormat: Video3DFormat.nullable(),
  PremiereDate: z.string().datetime({ offset: true }).nullable(),
  ExternalUrls: z.array(ExternalUrl).nullable(),
  MediaSources: z.array(MediaSourceInfo).nullable(),
  CriticRating: z.number().nullable(),
  ProductionLocations: z.array(z.string()).nullable(),
  Path: z.string().nullable(),
  EnableMediaSourceDisplay: z.boolean().nullable(),
  OfficialRating: z.string().nullable(),
  CustomRating: z.string().nullable(),
  ChannelId: z.string().uuid().nullable(),
  ChannelName: z.string().nullable(),
  Overview: z.string().nullable(),
  Taglines: z.array(z.string()).nullable(),
  Genres: z.array(z.string()).nullable(),
  CommunityRating: z.number().nullable(),
  CumulativeRunTimeTicks: z.number().int().nullable(),
  RunTimeTicks: z.number().int().nullable(),
  // PlayAccess: PlayAccess.nullable(),
  AspectRatio: z.string().nullable(),
  ProductionYear: z.number().int().nullable(),
  IsPlaceHolder: z.boolean().nullable(),
  Number: z.string().nullable(),
  ChannelNumber: z.string().nullable(),
  IndexNumber: z.number().int().nullable(),
  IndexNumberEnd: z.number().int().nullable(),
  ParentIndexNumber: z.number().int().nullable(),
  // RemoteTrailers: z.array(MediaUrl).nullable(),
  ProviderIds: z.record(z.string().nullable()).nullable(),
  IsHD: z.boolean().nullable(),
  IsFolder: z.boolean().nullable(),
  ParentId: z.string().uuid().nullable(),
  Type: BaseItemKind,
  // People: z.array(BaseItemPerson).nullable(),
  Studios: z.array(NameGuidPair).nullable(),
  GenreItems: z.array(NameGuidPair).nullable(),
  ParentLogoItemId: z.string().uuid().nullable(),
  ParentBackdropItemId: z.string().uuid().nullable(),
  ParentBackdropImageTags: z.array(z.string()).nullable(),
  LocalTrailerCount: z.number().int().nullable(),
  // UserData: UserItemDataDto.nullable(),
  RecursiveItemCount: z.number().int().nullable(),
  ChildCount: z.number().int().nullable(),
  SeriesName: z.string().nullable(),
  SeriesId: z.string().uuid().nullable(),
  SeasonId: z.string().uuid().nullable(),
  SpecialFeatureCount: z.number().int().nullable(),
  DisplayPreferencesId: z.string().nullable(),
  Status: z.string().nullable(),
  AirTime: z.string().nullable(),
  // AirDays: z.array(DayOfWeek).nullable(),
  Tags: z.array(z.string()).nullable(),
  PrimaryImageAspectRatio: z.number().nullable(),
  Artists: z.array(z.string()).nullable(),
  ArtistItems: z.array(NameGuidPair).nullable(),
  Album: z.string().nullable(),
  CollectionType: CollectionType.nullable(),
  DisplayOrder: z.string().nullable(),
  AlbumId: z.string().uuid().nullable(),
  AlbumPrimaryImageTag: z.string().nullable(),
  SeriesPrimaryImageTag: z.string().nullable(),
  AlbumArtist: z.string().nullable(),
  AlbumArtists: z.array(NameGuidPair).nullable(),
  SeasonName: z.string().nullable(),
  MediaStreams: z.array(MediaStream).nullable(),
  VideoType: VideoType.nullable(),
  PartCount: z.number().int().nullable(),
  MediaSourceCount: z.number().int().nullable(),
  ImageTags: z.record(z.string()).nullable(),
  BackdropImageTags: z.array(z.string()).nullable(),
  ScreenshotImageTags: z.array(z.string()).nullable(),
  ParentLogoImageTag: z.string().nullable(),
  ParentArtItemId: z.string().uuid().nullable(),
  ParentArtImageTag: z.string().nullable(),
  SeriesThumbImageTag: z.string().nullable(),
  ImageBlurHashes: z
    .object({
      Primary: z.record(z.string()),
      Art: z.record(z.string()),
      Backdrop: z.record(z.string()),
      Banner: z.record(z.string()),
      Logo: z.record(z.string()),
      Thumb: z.record(z.string()),
      Disc: z.record(z.string()),
      Box: z.record(z.string()),
      Screenshot: z.record(z.string()),
      Menu: z.record(z.string()),
      Chapter: z.record(z.string()),
      BoxRear: z.record(z.string()),
      Profile: z.record(z.string()),
    })
    .partial()
    .passthrough()
    .nullable(),
  SeriesStudio: z.string().nullable(),
  ParentThumbItemId: z.string().uuid().nullable(),
  ParentThumbImageTag: z.string().nullable(),
  ParentPrimaryImageItemId: z.string().nullable(),
  ParentPrimaryImageTag: z.string().nullable(),
  Chapters: z.array(ChapterInfo).nullable(),
  // Trickplay: z.record(z.record(TrickplayInfo)).nullable(),
  // LocationType: LocationType.nullable(),
  IsoType: IsoType.nullable(),
  MediaType: JellyfinMediaType,
  EndDate: z.string().datetime({ offset: true }).nullable(),
  // LockedFields: z.array(MetadataField).nullable(),
  TrailerCount: z.number().int().nullable(),
  MovieCount: z.number().int().nullable(),
  SeriesCount: z.number().int().nullable(),
  ProgramCount: z.number().int().nullable(),
  EpisodeCount: z.number().int().nullable(),
  SongCount: z.number().int().nullable(),
  AlbumCount: z.number().int().nullable(),
  ArtistCount: z.number().int().nullable(),
  MusicVideoCount: z.number().int().nullable(),
  LockData: z.boolean().nullable(),
  Width: z.number().int().nullable(),
  Height: z.number().int().nullable(),
  CameraMake: z.string().nullable(),
  CameraModel: z.string().nullable(),
  Software: z.string().nullable(),
  ExposureTime: z.number().nullable(),
  FocalLength: z.number().nullable(),
  // ImageOrientation: ImageOrientation.nullable(),
  Aperture: z.number().nullable(),
  ShutterSpeed: z.number().nullable(),
  Latitude: z.number().nullable(),
  Longitude: z.number().nullable(),
  Altitude: z.number().nullable(),
  IsoSpeedRating: z.number().int().nullable(),
  SeriesTimerId: z.string().nullable(),
  ProgramId: z.string().nullable(),
  ChannelPrimaryImageTag: z.string().nullable(),
  StartDate: z.string().datetime({ offset: true }).nullable(),
  CompletionPercentage: z.number().nullable(),
  IsRepeat: z.boolean().nullable(),
  EpisodeTitle: z.string().nullable(),
  // ChannelType: ChannelType.nullable(),
  // Audio: ProgramAudio.nullable(),
  IsMovie: z.boolean().nullable(),
  IsSports: z.boolean().nullable(),
  IsSeries: z.boolean().nullable(),
  IsLive: z.boolean().nullable(),
  IsNews: z.boolean().nullable(),
  IsKids: z.boolean().nullable(),
  IsPremiere: z.boolean().nullable(),
  TimerId: z.string().nullable(),
  NormalizationGain: z.number().nullable(),
  // CurrentProgram: BaseItemDto.nullable(),
});
// );

// export const JellyfinLibraryItem = z.object({
//   Name: z.string(),
//   Id: z.string(),
//   Etag: z.string().optional(),
//   // We should always request this
//   Path: z.string().optional(),
//   OfficialRating: z.string().optional(),
//   DateCreated: z.string().optional(),
//   CommunityRating: z.number().optional(),
//   RunTimeTicks: z.number(),
//   Genres: z.array(z.string()).optional(),
//   Tags: z.array(z.string()).optional(),
//   ProductionYear: z.number().optional(),
//   ProviderIds: z.object({
//     Imdb: z.string().optional(),
//     Tmdb: z.string().optional(),
//     TmdbCollection: z.string().optional(),
//     Tvdb: z.string().optional(),
//   }),
//   PremiereDate: z.string().optional(),
//   MediaStreams: z.array(JellyfinMediaStream).optional(),
//   LocationType: z.string(),
//   Overview: z.string(),
//   Taglines: z.array(z.string()).optional(),
//   Studios: z.array(JellyfinJoinItem).optional(),
//   People: z.array(JellyfinPerson).optional(),
//   ImageTags: z
//     .object({
//       Primary: z.string().optional(),
//       Logo: z.string().optional(),
//       Thumb: z.string().optional(),
//     })
//     .optional(),
//   BackdropImageTags: z.array(z.string()).optional(),
//   IndexNumber: z.number().optional(),
//   Type: z.string(),
//   Chapters: z.array(JellyfinChapter).optional(),
// });

export const JellyfinLibraryItemsResponse = z.object({
  Items: z.array(JellyfinBaseItemSchema),
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

export const JellyfinSystemInfo = z
  .object({
    LocalAddress: z.string().nullable(),
    ServerName: z.string().nullable(),
    Version: z.string().nullable(),
    ProductName: z.string().nullable(),
    OperatingSystem: z.string().nullable(),
    Id: z.string().nullable(),
    StartupWizardCompleted: z.boolean().nullable(),
    OperatingSystemDisplayName: z.string().nullable(),
    PackageName: z.string().nullable(),
    HasPendingRestart: z.boolean(),
    IsShuttingDown: z.boolean(),
    SupportsLibraryMonitor: z.boolean(),
    WebSocketPortNumber: z.number().int(),
    // CompletedInstallations: z.array(InstallationInfo).nullable(),
    CanSelfRestart: z.boolean().default(true),
    CanLaunchWebBrowser: z.boolean().default(false),
    ProgramDataPath: z.string().nullable(),
    WebPath: z.string().nullable(),
    ItemsByNamePath: z.string().nullable(),
    CachePath: z.string().nullable(),
    LogPath: z.string().nullable(),
    InternalMetadataPath: z.string().nullable(),
    TranscodingTempPath: z.string().nullable(),
    // CastReceiverApplications: z.array(CastReceiverApplication).nullable(),
    HasUpdateAvailable: z.boolean().default(false),
    EncoderLocation: z.string().nullable().default('System'),
    SystemArchitecture: z.string().nullable().default('X64'),
  })
  .partial();
