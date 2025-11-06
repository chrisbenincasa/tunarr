import { z } from 'zod/v4';

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
  'OfficialRating',
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

export type JellyfinItemFields = z.infer<typeof JellyfinItemFields>;

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

export type JellyfinItemFilter = z.infer<typeof JellyfinItemFilter>;

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

export type JellyfinItemSortBy = z.infer<typeof JellyfinItemSortBy>;

export const JellyfinCollectionType = z.enum([
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

export type JellyfinCollectionType = z.infer<typeof JellyfinCollectionType>;

export const JellyfinSortOrder = z.enum(['Ascending', 'Descending']);

const ChapterInfo = z
  .object({
    StartPositionTicks: z.number().int(),
    Name: z.string().nullish(),
    ImagePath: z.string().nullish(),
    ImageDateModified: z.iso.datetime({ offset: true }),
    ImageTag: z.string().nullish(),
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
  NetworkPath: z.string().nullable().optional(),
});

export const JellyfinLibraryOptions = z.object({
  PathInfos: z.array(JellyfinLibraryPathInfo),
});

export const JellyfinLibrary = z.object({
  Name: z.string(),
  CollectionType: JellyfinCollectionType.optional().catch('unknown'),
  ItemId: z.string(),
  LibraryOptions: JellyfinLibraryOptions,
});

export type JellyfinLibrary = z.infer<typeof JellyfinLibrary>;

export const JellyfinLibraryResponse = z.array(JellyfinLibrary);

export const JellyfinVirtualFolder = z.object({
  Name: z.string(),
  CollectionType: JellyfinCollectionType.optional().catch('unknown'),
  ItemId: z.string(),
  LibraryOptions: JellyfinLibraryOptions,
  Locations: z.array(z.string()),
});

export const TunarrAmendedJellyfinVirtualFolder = z.object({
  ...JellyfinVirtualFolder.shape,
  jellyfinType: z.literal('VirtualFolder'),
  tunarrLibraryId: z.string().optional(),
});

export type TunarrAmendedJellyfinVirtualFolder = z.infer<
  typeof TunarrAmendedJellyfinVirtualFolder
>;

export function isJellyfinVirtualFolder(
  item: TunarrAmendedJellyfinVirtualFolder | JellyfinItem,
): item is TunarrAmendedJellyfinVirtualFolder {
  return 'jellyfinType' in item && item.jellyfinType === 'VirtualFolder';
}

export type JellyfinVirtualFolder = z.infer<typeof JellyfinVirtualFolder>;

export const JellyfinVirtualFolderResponse = JellyfinVirtualFolder.array();

export const JellyfinMediaStream = z.object({
  Type: z.string(),
  Codec: z.string(),
  Language: z.string(),
  IsInterlaced: z.boolean().nullable().optional(),
  Height: z.number().positive().nullable().optional().catch(undefined),
  Width: z.number().positive().nullable().optional().catch(undefined),
  Index: z.number(),
  IsDefault: z.boolean(),
  IsForced: z.boolean(),
  IsExternal: z.boolean(),
  IsHearingImpaired: z.boolean().nullable().optional(),
  VideoRange: z.string().nullable().optional(),
  AudioSpatialFormat: z.string().nullable().optional(),
  AspectRatio: z.string().nullable().optional(),
  BitRate: z.number().positive().nullable().optional(),
  ChannelLayout: z.string().nullable().optional(),
  Channels: z.number().positive().nullable().optional(),
  RealFrameRate: z.number().positive().nullable().optional(),
  PixelFormat: z.string().nullable().optional(),
  Title: z.string().nullable().optional(),
  Profile: z.string().nullable().optional(),
  ColorRange: z.string().nullable().optional(),
  ColorSpace: z.string().nullable().optional(),
  ColorTransfer: z.string().nullable().optional(),
  ColorPrimaries: z.string().nullable().optional(),
  IsAnamorphic: z.boolean().nullable().optional(),
});

export const JellyfinImageBlurHashes = z.object({
  Backdrop: z.record(z.string(), z.string()).nullable().optional(),
  Primary: z.record(z.string(), z.string()).nullable().optional(),
  Logo: z.record(z.string(), z.string()).nullable().optional(),
  Thumb: z.record(z.string(), z.string()).nullable().optional(),
});

export const JellyfinJoinItem = z.object({
  Name: z.string(),
  Id: z.string(),
});

export const JellyfinPerson = JellyfinJoinItem.extend({
  Id: z.string(),
  Role: z.string().nullable().optional(),
  Type: z.string().nullable().optional(),
  PrimaryImageTag: z.string().nullable().optional(),
  ImageBlurHashes: JellyfinImageBlurHashes.nullable().optional(),
});

export type JellyfinPerson = z.infer<typeof JellyfinPerson>;

export const JellyfinChapter = z.object({
  StartPositionTicks: z.number().positive(),
  Name: z.string().nullable().optional(),
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

export const JellyfinItemKind = z.enum([
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

export type JellyfinItemKind = z.infer<typeof JellyfinItemKind>;

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
  .object({ Name: z.string().nullable().optional(), Id: z.string() })
  .partial();

type NameGuidPair = z.infer<typeof NameGuidPair>;

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
  .object({
    Name: z.string().nullable().optional(),
    Url: z.string().nullable().optional(),
  })
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
    Codec: z.string().nullable().optional(),
    CodecTag: z.string().nullable().optional(),
    Comment: z.string().nullable().optional(),
    Index: z.number().int(),
    FileName: z.string().nullable().optional(),
    MimeType: z.string().nullable().optional(),
    DeliveryUrl: z.string().nullable().optional(),
  })
  .partial();

const MediaStream = z
  .object({
    Codec: z.string().nullable().optional(),
    CodecTag: z.string().nullable().optional(),
    Language: z.string().nullable().optional(),
    ColorRange: z.string().nullable().optional(),
    ColorSpace: z.string().nullable().optional(),
    ColorTransfer: z.string().nullable().optional(),
    ColorPrimaries: z.string().nullable().optional(),
    DvVersionMajor: z.number().int().nullable().optional(),
    DvVersionMinor: z.number().int().nullable().optional(),
    DvProfile: z.number().int().nullable().optional(),
    DvLevel: z.number().int().nullable().optional(),
    RpuPresentFlag: z.number().int().nullable().optional(),
    ElPresentFlag: z.number().int().nullable().optional(),
    BlPresentFlag: z.number().int().nullable().optional(),
    DvBlSignalCompatibilityId: z.number().int().nullable().optional(),
    Comment: z.string().nullable().optional(),
    TimeBase: z.string().nullable().optional(),
    CodecTimeBase: z.string().nullable().optional(),
    Title: z.string().nullable().optional(),
    VideoRange: VideoRange,
    VideoRangeType: VideoRangeType.catch('Unknown'),
    VideoDoViTitle: z.string().nullable().optional(),
    // AudioSpatialFormat: AudioSpatialFormat.default('None'),
    LocalizedUndefined: z.string().nullable().optional(),
    LocalizedDefault: z.string().nullable().optional(),
    LocalizedForced: z.string().nullable().optional(),
    LocalizedExternal: z.string().nullable().optional(),
    LocalizedHearingImpaired: z.string().nullable().optional(),
    DisplayTitle: z.string().nullable().optional(),
    NalLengthSize: z.string().nullable().optional(),
    IsInterlaced: z.boolean(),
    IsAVC: z.boolean().nullable().optional(),
    ChannelLayout: z.string().nullable().optional(),
    BitRate: z.number().int().nullable().optional(),
    BitDepth: z.number().int().nullable().optional(),
    RefFrames: z.number().int().nullable().optional(),
    PacketLength: z.number().int().nullable().optional(),
    Channels: z.number().int().nullable().optional(),
    SampleRate: z.number().int().nullable().optional(),
    IsDefault: z.boolean(),
    IsForced: z.boolean(),
    IsHearingImpaired: z.boolean(),
    Height: z.number().int().nullable().optional(),
    Width: z.number().int().nullable().optional(),
    AverageFrameRate: z.number().nullable().optional(),
    RealFrameRate: z.number().nullable().optional(),
    Profile: z.string().nullable().optional(),
    Type: MediaStreamType,
    AspectRatio: z.string().nullable().optional(),
    Index: z.number().int(),
    Score: z.number().int().nullable().optional(),
    IsExternal: z.boolean(),
    DeliveryMethod: SubtitleDeliveryMethod.nullable().optional(),
    DeliveryUrl: z.string().nullable().optional(),
    IsExternalUrl: z.boolean().nullable().optional(),
    IsTextSubtitleStream: z.boolean(),
    SupportsExternalStream: z.boolean(),
    Path: z.string().nullable().optional(),
    PixelFormat: z.string().nullable().optional(),
    Level: z.number().nullable().optional(),
    IsAnamorphic: z.boolean().nullable().optional(),
  })
  .partial();

export type JellyfinMediaStream = z.infer<typeof MediaStream>;

const MediaSourceInfo = z
  .object({
    Protocol: MediaProtocol,
    Id: z.string().nullable().optional(),
    Path: z.string().nullable().optional(),
    EncoderPath: z.string().nullable().optional(),
    EncoderProtocol: MediaProtocol.nullable().optional(),
    Type: MediaSourceType,
    Container: z.string().nullable().optional(),
    Size: z.number().int().nullable().optional(),
    Name: z.string().nullable().optional(),
    IsRemote: z.boolean(),
    ETag: z.string().nullable().optional(),
    RunTimeTicks: z.number().int().nullable().optional(),
    ReadAtNativeFramerate: z.boolean(),
    IgnoreDts: z.boolean(),
    IgnoreIndex: z.boolean(),
    GenPtsInput: z.boolean(),
    SupportsTranscoding: z.boolean(),
    SupportsDirectStream: z.boolean(),
    SupportsDirectPlay: z.boolean(),
    IsInfiniteStream: z.boolean(),
    RequiresOpening: z.boolean(),
    OpenToken: z.string().nullable().optional(),
    RequiresClosing: z.boolean(),
    LiveStreamId: z.string().nullable().optional(),
    BufferMs: z.number().int().nullable().optional(),
    RequiresLooping: z.boolean(),
    SupportsProbing: z.boolean(),
    VideoType: VideoType.nullable().optional(),
    IsoType: IsoType.nullable().optional(),
    Video3DFormat: Video3DFormat.nullable().optional(),
    MediaStreams: z.array(MediaStream).nullable().optional(),
    MediaAttachments: z.array(MediaAttachment).nullable().optional(),
    Formats: z.array(z.string()).nullable().optional(),
    Bitrate: z.number().int().nullable().optional(),
    // Timestamp: TransportStreamTimestamp.nullable().optional(),
    RequiredHttpHeaders: z.record(z.string(), z.string()).nullish(),
    TranscodingUrl: z.string().nullable().optional(),
    // TranscodingSubProtocol: MediaStreamProtocol,
    TranscodingContainer: z.string().nullable().optional(),
    AnalyzeDurationMs: z.number().int().nullable().optional(),
    DefaultAudioStreamIndex: z.number().int().nullable().optional(),
    DefaultSubtitleStreamIndex: z.number().int().nullable().optional(),
  })
  .partial();

export type JellyfinMediaSourceInfo = z.infer<typeof MediaSourceInfo>;

export const JellyfinItem = z.object({
  Name: z.string().nullable().optional(),
  OriginalTitle: z.string().nullable().optional(),
  ServerId: z.string().nullable().optional(),
  Id: z.string(),
  Etag: z.string().nullable().optional(),
  SourceType: z.string().nullable().optional(),
  PlaylistItemId: z.string().nullable().optional(),
  DateCreated: z.string().datetime({ offset: true }).nullable().optional(),
  DateLastMediaAdded: z
    .string()
    .datetime({ offset: true })
    .nullable()
    .optional(),
  ExtraType: ExtraType.nullable().optional(),
  AirsBeforeSeasonNumber: z.number().int().nullable().optional(),
  AirsAfterSeasonNumber: z.number().int().nullable().optional(),
  AirsBeforeEpisodeNumber: z.number().int().nullable().optional(),
  CanDelete: z.boolean().nullable().optional(),
  CanDownload: z.boolean().nullable().optional(),
  HasLyrics: z.boolean().nullable().optional(),
  HasSubtitles: z.boolean().nullable().optional(),
  PreferredMetadataLanguage: z.string().nullable().optional(),
  PreferredMetadataCountryCode: z.string().nullable().optional(),
  Container: z.string().nullable().optional(),
  SortName: z.string().nullable().optional(),
  ForcedSortName: z.string().nullable().optional(),
  Video3DFormat: Video3DFormat.nullable().optional(),
  PremiereDate: z.string().datetime({ offset: true }).nullable().optional(),
  ExternalUrls: z.array(ExternalUrl).nullable().optional(),
  MediaSources: z.array(MediaSourceInfo).nullable().optional(),
  CriticRating: z.number().nullable().optional(),
  ProductionLocations: z.array(z.string()).nullable().optional(),
  Path: z.string().nullable().optional(),
  EnableMediaSourceDisplay: z.boolean().nullable().optional(),
  OfficialRating: z.string().nullable().optional(),
  CustomRating: z.string().nullable().optional(),
  ChannelId: z.string().nullable().optional(),
  ChannelName: z.string().nullable().optional(),
  Overview: z.string().nullable().optional(),
  Taglines: z.array(z.string()).nullable().optional(),
  Genres: z.array(z.string()).nullable().optional(),
  CommunityRating: z.number().nullable().optional(),
  CumulativeRunTimeTicks: z.number().int().nullable().optional(),
  RunTimeTicks: z.number().int().nullable().optional(),
  // PlayAccess: PlayAccess.nullable().optional(),
  AspectRatio: z.string().nullable().optional(),
  ProductionYear: z.number().int().nullable().optional(),
  IsPlaceHolder: z.boolean().nullable().optional(),
  Number: z.string().nullable().optional(),
  ChannelNumber: z.string().nullable().optional(),
  IndexNumber: z.number().int().nullable().optional(),
  IndexNumberEnd: z.number().int().nullable().optional(),
  ParentIndexNumber: z.number().int().nullable().optional(),
  // RemoteTrailers: z.array(MediaUrl).nullable().optional(),
  ProviderIds: z.record(z.string(), z.string()).nullable().optional(),
  IsHD: z.boolean().nullable().optional(),
  IsFolder: z.boolean().nullable().optional(),
  ParentId: z.string().nullable().optional(),
  Type: JellyfinItemKind,
  People: z.array(JellyfinPerson).nullable().optional(),
  Studios: z.array(NameGuidPair).nullable().optional(),
  GenreItems: z.array(NameGuidPair).nullable().optional(),
  ParentLogoItemId: z.string().nullable().optional(),
  ParentBackdropItemId: z.string().nullable().optional(),
  ParentBackdropImageTags: z.array(z.string()).nullable().optional(),
  LocalTrailerCount: z.number().int().nullable().optional(),
  // UserData: UserItemDataDto.nullable().optional(),
  RecursiveItemCount: z.number().int().nullable().optional(),
  ChildCount: z.number().int().nullable().optional(),
  SeriesName: z.string().nullable().optional(),
  SeriesId: z.string().nullable().optional(),
  SeasonId: z.string().nullable().optional(),
  SpecialFeatureCount: z.number().int().nullable().optional(),
  DisplayPreferencesId: z.string().nullable().optional(),
  Status: z.string().nullable().optional(),
  AirTime: z.string().nullable().optional(),
  // AirDays: z.array(DayOfWeek).nullable().optional(),
  Tags: z.array(z.string()).nullable().optional(),
  PrimaryImageAspectRatio: z.number().nullable().optional(),
  Artists: z.array(z.string()).nullable().optional(),
  ArtistItems: z.array(NameGuidPair).nullable().optional(),
  Album: z.string().nullable().optional(),
  CollectionType: JellyfinCollectionType.nullable().optional(),
  DisplayOrder: z.string().nullable().optional(),
  AlbumId: z.string().nullable().optional(),
  AlbumPrimaryImageTag: z.string().nullable().optional(),
  SeriesPrimaryImageTag: z.string().nullable().optional(),
  AlbumArtist: z.string().nullable().optional(),
  AlbumArtists: z.array(NameGuidPair).nullable().optional(),
  SeasonName: z.string().nullable().optional(),
  MediaStreams: z.array(MediaStream).nullable().optional(),
  VideoType: VideoType.nullable().optional(),
  PartCount: z.number().int().nullable().optional(),
  MediaSourceCount: z.number().int().nullable().optional(),
  ImageTags: z.record(z.string(), z.string()).nullable().optional(),
  BackdropImageTags: z.array(z.string()).nullable().optional(),
  ScreenshotImageTags: z.array(z.string()).nullable().optional(),
  ParentLogoImageTag: z.string().nullable().optional(),
  ParentArtItemId: z.string().nullable().optional(),
  ParentArtImageTag: z.string().nullable().optional(),
  SeriesThumbImageTag: z.string().nullable().optional(),
  ImageBlurHashes: z
    .object({
      Primary: z.record(z.string(), z.string()),
      Art: z.record(z.string(), z.string()),
      Backdrop: z.record(z.string(), z.string()),
      Banner: z.record(z.string(), z.string()),
      Logo: z.record(z.string(), z.string()),
      Thumb: z.record(z.string(), z.string()),
      Disc: z.record(z.string(), z.string()),
      Box: z.record(z.string(), z.string()),
      Screenshot: z.record(z.string(), z.string()),
      Menu: z.record(z.string(), z.string()),
      Chapter: z.record(z.string(), z.string()),
      BoxRear: z.record(z.string(), z.string()),
      Profile: z.record(z.string(), z.string()),
    })
    .partial()
    // .passthrough()
    .nullable()
    .optional(),
  SeriesStudio: z.string().nullable().optional(),
  ParentThumbItemId: z.string().nullable().optional(),
  ParentThumbImageTag: z.string().nullable().optional(),
  ParentPrimaryImageItemId: z.string().nullable().optional(),
  ParentPrimaryImageTag: z.string().nullable().optional(),
  Chapters: z.array(ChapterInfo).nullable().optional(),
  // Trickplay: z.record(z.record(TrickplayInfo)).nullable().optional(),
  // LocationType: LocationType.nullable().optional(),
  IsoType: IsoType.nullable().optional(),
  MediaType: JellyfinMediaType,
  EndDate: z.string().datetime({ offset: true }).nullable().optional(),
  // LockedFields: z.array(MetadataField).nullable().optional(),
  TrailerCount: z.number().int().nullable().optional(),
  MovieCount: z.number().int().nullable().optional(),
  SeriesCount: z.number().int().nullable().optional(),
  ProgramCount: z.number().int().nullable().optional(),
  EpisodeCount: z.number().int().nullable().optional(),
  SongCount: z.number().int().nullable().optional(),
  AlbumCount: z.number().int().nullable().optional(),
  ArtistCount: z.number().int().nullable().optional(),
  MusicVideoCount: z.number().int().nullable().optional(),
  LockData: z.boolean().nullable().optional(),
  Width: z.number().int().nullable().optional(),
  Height: z.number().int().nullable().optional(),
  CameraMake: z.string().nullable().optional(),
  CameraModel: z.string().nullable().optional(),
  Software: z.string().nullable().optional(),
  ExposureTime: z.number().nullable().optional(),
  FocalLength: z.number().nullable().optional(),
  // ImageOrientation: ImageOrientation.nullable().optional(),
  Aperture: z.number().nullable().optional(),
  ShutterSpeed: z.number().nullable().optional(),
  Latitude: z.number().nullable().optional(),
  Longitude: z.number().nullable().optional(),
  Altitude: z.number().nullable().optional(),
  IsoSpeedRating: z.number().int().nullable().optional(),
  SeriesTimerId: z.string().nullable().optional(),
  ProgramId: z.string().nullable().optional(),
  ChannelPrimaryImageTag: z.string().nullable().optional(),
  StartDate: z.string().datetime({ offset: true }).nullable().optional(),
  CompletionPercentage: z.number().nullable().optional(),
  IsRepeat: z.boolean().nullable().optional(),
  EpisodeTitle: z.string().nullable().optional(),
  // ChannelType: ChannelType.nullable().optional(),
  // Audio: ProgramAudio.nullable().optional(),
  IsMovie: z.boolean().nullable().optional(),
  IsSports: z.boolean().nullable().optional(),
  IsSeries: z.boolean().nullable().optional(),
  IsLive: z.boolean().nullable().optional(),
  IsNews: z.boolean().nullable().optional(),
  IsKids: z.boolean().nullable().optional(),
  IsPremiere: z.boolean().nullable().optional(),
  TimerId: z.string().nullable().optional(),
  NormalizationGain: z.number().nullable().optional(),
  // CurrentProgram: BaseItemDto.nullable().optional(),
});
// );

export type JellyfinItem = z.infer<typeof JellyfinItem>;

// export const JellyfinLibraryItem = z.object({
//   Name: z.string(),
//   Id: z.string(),
//   Etag: z.string().nullable().optional(),
//   // We should always request this
//   Path: z.string().nullable().optional(),
//   OfficialRating: z.string().nullable().optional(),
//   DateCreated: z.string().nullable().optional(),
//   CommunityRating: z.number().nullable().optional(),
//   RunTimeTicks: z.number(),
//   Genres: z.array(z.string()).nullable().optional(),
//   Tags: z.array(z.string()).nullable().optional(),
//   ProductionYear: z.number().nullable().optional(),
//   ProviderIds: z.object({
//     Imdb: z.string().nullable().optional(),
//     Tmdb: z.string().nullable().optional(),
//     TmdbCollection: z.string().nullable().optional(),
//     Tvdb: z.string().nullable().optional(),
//   }),
//   PremiereDate: z.string().nullable().optional(),
//   MediaStreams: z.array(JellyfinMediaStream).nullable().optional(),
//   LocationType: z.string(),
//   Overview: z.string(),
//   Taglines: z.array(z.string()).nullable().optional(),
//   Studios: z.array(JellyfinJoinItem).nullable().optional(),
//   People: z.array(JellyfinPerson).nullable().optional(),
//   ImageTags: z
//     .object({
//       Primary: z.string().nullable().optional(),
//       Logo: z.string().nullable().optional(),
//       Thumb: z.string().nullable().optional(),
//     })
//     .nullable().optional(),
//   BackdropImageTags: z.array(z.string()).nullable().optional(),
//   IndexNumber: z.number().nullable().optional(),
//   Type: z.string(),
//   Chapters: z.array(JellyfinChapter).nullable().optional(),
// });

export const JellyfinLibraryItemsResponse = z.object({
  Items: z.array(JellyfinItem),
  TotalRecordCount: z.number(),
  StartIndex: z.number().nullable().optional(),
});

export type JellyfinLibraryItemsResponse = z.infer<
  typeof JellyfinLibraryItemsResponse
>;

export const JellyfinGenresResponse = JellyfinLibraryItemsResponse;
export type JellyfinGenresResponse = JellyfinLibraryItemsResponse;

const JellyfinSessionInfo = z
  .object({
    // PlayState: PlayerStateInfo.nullable().optional(),
    // AdditionalUsers: z.array(SessionUserInfo).nullable().optional(),
    // Capabilities: ClientCapabilities.nullable().optional(),
    RemoteEndPoint: z.string().nullable().optional(),
    PlayableMediaTypes: z.array(JellyfinMediaType).nullable().optional(),
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

export const JellyfinUserConfiguration = z
  .object({
    AudioLanguagePreference: z.string().nullable().optional(),
    PlayDefaultAudioTrack: z.boolean(),
    SubtitleLanguagePreference: z.string().nullable().optional(),
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
    CastReceiverId: z.string().nullable().optional(),
  })
  .partial();

const JellyfinUserPolicy = z.object({
  IsAdministrator: z.boolean().optional(),
  IsHidden: z.boolean().optional(),
  EnableCollectionManagement: z.boolean().optional().default(false),
  EnableSubtitleManagement: z.boolean().optional().default(false),
  EnableLyricManagement: z.boolean().optional().default(false),
  IsDisabled: z.boolean().optional(),
  MaxParentalRating: z.number().int().nullish(),
  BlockedTags: z.array(z.string()).nullish(),
  AllowedTags: z.array(z.string()).nullish(),
  EnableUserPreferenceAccess: z.boolean().optional(),
  // AccessSchedules: z.array(AccessSchedule).nullish(),
  // BlockUnratedItems: z.array(UnratedItem).nullish(),
  EnableRemoteControlOfOtherUsers: z.boolean().optional(),
  EnableSharedDeviceControl: z.boolean().optional(),
  EnableRemoteAccess: z.boolean().optional(),
  EnableLiveTvManagement: z.boolean().optional(),
  EnableLiveTvAccess: z.boolean().optional(),
  EnableMediaPlayback: z.boolean().optional(),
  EnableAudioPlaybackTranscoding: z.boolean().optional(),
  EnableVideoPlaybackTranscoding: z.boolean().optional(),
  EnablePlaybackRemuxing: z.boolean().optional(),
  ForceRemoteSourceTranscoding: z.boolean().optional(),
  EnableContentDeletion: z.boolean().optional(),
  EnableContentDeletionFromFolders: z.array(z.string()).nullish(),
  EnableContentDownloading: z.boolean().optional(),
  EnableSyncTranscoding: z.boolean().optional(),
  EnableMediaConversion: z.boolean().optional(),
  EnabledDevices: z.array(z.string()).nullish(),
  EnableAllDevices: z.boolean().optional(),
  EnabledChannels: z.array(z.string()).nullish(),
  EnableAllChannels: z.boolean().optional(),
  EnabledFolders: z.array(z.string()).nullish(),
  EnableAllFolders: z.boolean().optional(),
  InvalidLoginAttemptCount: z.number().int().optional(),
  LoginAttemptsBeforeLockout: z.number().int().optional(),
  MaxActiveSessions: z.number().int().optional(),
  EnablePublicSharing: z.boolean().optional(),
  BlockedMediaFolders: z.array(z.string()).nullish(),
  BlockedChannels: z.array(z.string()).nullish(),
  RemoteClientBitrateLimit: z.number().int().optional(),
  AuthenticationProviderId: z.string(),
  PasswordResetProviderId: z.string(),
  // SyncPlayAccess: SyncPlayUserAccessType.optional(),
});

export const JellyfinUser = z.object({
  Name: z.string().nullish(),
  ServerId: z.string().nullish(),
  ServerName: z.string().nullish(),
  Id: z.string(),
  PrimaryImageTag: z.string().nullish(),
  HasPassword: z.boolean().nullish(),
  HasConfiguredPassword: z.boolean().nullish(),
  HasConfiguredEasyPassword: z.boolean().nullish(),
  EnableAutoLogin: z.boolean().nullish().nullish(),
  LastLoginDate: z.string().datetime({ offset: true }).nullish(),
  LastActivityDate: z.string().datetime({ offset: true }).nullish(),
  Configuration: JellyfinUserConfiguration.nullish(),
  Policy: JellyfinUserPolicy.nullish(),
  PrimaryImageAspectRatio: z.number().nullish(),
});

export const JellyfinAuthenticationResult = z
  .object({
    User: JellyfinUser.nullable().optional(),
    SessionInfo: JellyfinSessionInfo.nullable().optional(),
    AccessToken: z.string().nullable().optional(),
    ServerId: z.string().nullable().optional(),
  })
  .partial();

export const JellyfinSystemInfo = z
  .object({
    LocalAddress: z.string().nullable().optional(),
    ServerName: z.string().nullable().optional(),
    Version: z.string().nullable().optional(),
    ProductName: z.string().nullable().optional(),
    OperatingSystem: z.string().nullable().optional(),
    Id: z.string().nullable().optional(),
    StartupWizardCompleted: z.boolean().nullable().optional(),
    OperatingSystemDisplayName: z.string().nullable().optional(),
    PackageName: z.string().nullable().optional(),
    HasPendingRestart: z.boolean(),
    IsShuttingDown: z.boolean(),
    SupportsLibraryMonitor: z.boolean(),
    WebSocketPortNumber: z.number().int(),
    // CompletedInstallations: z.array(InstallationInfo).nullable().optional(),
    CanSelfRestart: z.boolean().default(true),
    CanLaunchWebBrowser: z.boolean().default(false),
    ProgramDataPath: z.string().nullable().optional(),
    WebPath: z.string().nullable().optional(),
    ItemsByNamePath: z.string().nullable().optional(),
    CachePath: z.string().nullable().optional(),
    LogPath: z.string().nullable().optional(),
    InternalMetadataPath: z.string().nullable().optional(),
    TranscodingTempPath: z.string().nullable().optional(),
    // CastReceiverApplications: z.array(CastReceiverApplication).nullable().optional(),
    HasUpdateAvailable: z.boolean().default(false),
    EncoderLocation: z.string().nullable().optional().default('System'),
    SystemArchitecture: z.string().nullable().optional().default('X64'),
  })
  .partial();

export function isTerminalJellyfinItem(item: JellyfinItem): boolean {
  return [
    'Movie',
    'Episode',
    'Audio',
    'Video',
    'Trailer',
    'MusicVideo',
  ].includes(item.Type);
}

export function isJellyfinType(
  item: JellyfinItem,
  types: JellyfinItemKind[],
): boolean {
  return types.includes(item.Type);
}
