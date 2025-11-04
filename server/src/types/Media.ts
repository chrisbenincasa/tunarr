/* eslint-disable @typescript-eslint/no-explicit-any */
import type { MediaSourceType } from '@/db/schema/base.js';
import type { Folder } from '@tunarr/types';
import type {
  Episode,
  ExternalIdType,
  HasMediaSourceInfo,
  MediaItem,
  MediaStream,
  Movie,
  MusicAlbum,
  MusicArtist as MusicArtistSchema,
  MusicTrack,
  MusicVideo,
  OtherVideo,
  Season,
  Show,
} from '@tunarr/types/schemas';
import type z from 'zod';

export type MediaStreamTypes = {
  Video: 'video';
  Audio: 'audio';
  Subtitles: 'subtitles';
  Attachment: 'attachment';
  ExternalSubtitles: 'external_subtitles';
};

export type MediaStreamType = MediaStreamTypes[keyof MediaStreamTypes];

export type MediaStream = z.infer<typeof MediaStream>;

interface BaseMediaLocation {
  path: string;
}

export interface LocalMediaLocation extends BaseMediaLocation {
  type: 'local';
}

export interface MediaSourceMediaLocation extends BaseMediaLocation {
  type: 'remote';
  sourceType: MediaSourceType;
  externalKey: string;
}

export type MediaLocation = LocalMediaLocation | MediaSourceMediaLocation;

export type MediaItem = z.infer<typeof MediaItem>;

export interface Identifier {
  id: string;
  sourceId?: string;
  type: ExternalIdType;
}

export type Movie = z.infer<typeof Movie>;

export type Show = z.infer<typeof Show>;

export type Season<ShowT extends Show = Show> = z.infer<typeof Season> & {
  show?: ShowT;
};

export type Episode<
  ShowT extends Show = Show,
  SeasonT extends Season<ShowT> = Season<ShowT>,
> = z.infer<typeof Episode> & {
  season?: SeasonT;
};

export type SeasonWithShow<
  SeasonT extends Season = Season,
  ShowT extends Show = SeasonT extends Season<infer ShowInferred>
    ? ShowInferred
    : never,
> = SeasonT & { show: ShowT };

export type EpisodeWithAncestors2<
  EpisodeT extends Episode = Episode,
  ShowT extends Show = EpisodeT extends Episode<infer ShowInferred, any>
    ? ShowInferred
    : never,
  SeasonT extends Season<ShowT> = EpisodeT extends Episode<
    any,
    infer SeasonInferred
  >
    ? SeasonInferred
    : never,
> = EpisodeT & { season: SeasonWithShow<SeasonT, ShowT> };

export type EpisodeWithAncestors<
  ShowT extends Show = Show,
  SeasonT extends Season<ShowT> = Season<ShowT>,
  EpisodeT extends Episode<ShowT, SeasonT> = Episode<ShowT, SeasonT>,
> = EpisodeT & {
  season: SeasonT & {
    show: ShowT;
  };
};

export type MusicArtist = z.infer<typeof MusicArtistSchema>;

export type MusicAlbum<ArtistT extends MusicArtist = MusicArtist> = z.infer<
  typeof MusicAlbum
> & {
  artist?: ArtistT;
};

export type MusicTrack<
  ArtistT extends MusicArtist = MusicArtist,
  AlbumT extends MusicAlbum<ArtistT> = MusicAlbum<ArtistT>,
> = z.infer<typeof MusicTrack> & {
  album?: AlbumT;
};

export type AlbumWithArtist<
  AlbumT extends MusicAlbum = MusicAlbum,
  ArtistT extends MusicArtist = AlbumT extends MusicAlbum<infer ShowInferred>
    ? ShowInferred
    : never,
> = AlbumT & { artist: ArtistT };

export type MusicTrackWithAncestors<
  TrackT extends MusicTrack = MusicTrack,
  ArtistT extends MusicArtist = TrackT extends MusicTrack<
    infer ArtistInferred,
    any
  >
    ? ArtistInferred
    : never,
  AlbumT extends MusicAlbum<ArtistT> = TrackT extends MusicTrack<
    any,
    infer AlbumInferred
  >
    ? AlbumInferred
    : never,
> = TrackT & { album: AlbumWithArtist<AlbumT, ArtistT> };

export type MusicVideo = z.infer<typeof MusicVideo>;
export type OtherVideo = z.infer<typeof OtherVideo>;

export type AnyProgram = Movie | Episode;

export type HasMediaSourceInfo = z.infer<typeof HasMediaSourceInfo>;

export type HasMediaSourceAndLibraryId = {
  mediaSourceId: string;
  libraryId: string;
};

export type MediaSourceProgram = AnyProgram & HasMediaSourceInfo;

export type MediaSourceMovie = Movie & HasMediaSourceInfo;
export interface MediaSourceShow extends Show, HasMediaSourceInfo {}
export type MediaSourceSeason<ShowT extends Show = Show> = Season<ShowT> &
  HasMediaSourceInfo;
export type MediaSourceEpisode<
  ShowT extends Show = Show,
  SeasonT extends Season<ShowT> = Season<ShowT>,
  EpisodeT extends Episode<ShowT, SeasonT> = Episode<ShowT, SeasonT>,
> = EpisodeT & HasMediaSourceInfo;

export type MediaSourceMusicArtist = MusicArtist & HasMediaSourceInfo;
export type MediaSourceMusicAlbum<ArtistT extends MusicArtist = MusicArtist> =
  MusicAlbum<ArtistT> & HasMediaSourceInfo;
export type MediaSourceMusicTrack<
  ArtistT extends MusicArtist = MusicArtist,
  AlbumT extends MusicAlbum<ArtistT> = MusicAlbum<ArtistT>,
  TrackT extends MusicTrack<ArtistT, AlbumT> = MusicTrack<ArtistT, AlbumT>,
> = TrackT & HasMediaSourceInfo;

export type MediaSourceOtherVideo = OtherVideo & HasMediaSourceInfo;

type PlexMixin = HasMediaSourceInfo & {
  sourceType: typeof MediaSourceType.Plex;
};

export type PlexMovie = Movie & PlexMixin;
export type PlexShow = Show & PlexMixin;
export type PlexSeason = Season<PlexShow> & PlexMixin;
export type PlexEpisode = Episode<PlexShow, PlexSeason> & PlexMixin;
export type PlexArtist = MusicArtist & PlexMixin;
export type PlexAlbum = MusicAlbum<PlexArtist> & PlexMixin;
export type PlexTrack = MusicTrack<PlexArtist, PlexAlbum> & PlexMixin;
export type PlexOtherVideo = OtherVideo & PlexMixin;

export type PlexItem =
  | PlexMovie
  | PlexShow
  | PlexSeason
  | PlexEpisode
  | PlexArtist
  | PlexAlbum
  | PlexTrack
  | PlexOtherVideo;

interface JellyfinMixin extends HasMediaSourceInfo {
  sourceType: typeof MediaSourceType.Jellyfin;
}

interface EmbyMixin extends HasMediaSourceInfo {
  sourceType: typeof MediaSourceType.Emby;
}

export type JellyfinMovie = Movie & JellyfinMixin;
export type JellyfinShow = Show & JellyfinMixin;
export type JellyfinSeason = Season<JellyfinShow> & JellyfinMixin;
export type JellyfinEpisode = Episode<JellyfinShow, JellyfinSeason> &
  JellyfinMixin;

export type JellyfinMusicArtist = MusicArtist & JellyfinMixin;
export type JellyfinMusicAlbum = MusicAlbum<JellyfinMusicArtist> &
  JellyfinMixin;
export type JellyfinMusicTrack = MusicTrack<
  JellyfinMusicArtist,
  JellyfinMusicAlbum
> &
  JellyfinMixin;
export type JellyfinMusicVideo = MusicVideo & JellyfinMixin;
export type JellyfinOtherVideo = OtherVideo & JellyfinMixin;

export type JellyfinItem =
  | JellyfinMovie
  | JellyfinShow
  | JellyfinSeason
  | JellyfinEpisode
  | JellyfinMusicArtist
  | JellyfinMusicTrack
  | JellyfinMusicAlbum
  | JellyfinMusicVideo
  | JellyfinOtherVideo
  | Folder;

export type EmbyMovie = Movie & EmbyMixin;
export type EmbyShow = Show & EmbyMixin;
export type EmbySeason = Season<EmbyShow> & EmbyMixin;
export type EmbyEpisode = Episode<EmbyShow, EmbySeason> & EmbyMixin;

export type EmbyMusicArtist = MusicArtist & EmbyMixin;
export type EmbyMusicAlbum = MusicAlbum<EmbyMusicArtist> & EmbyMixin;
export type EmbyMusicTrack = MusicTrack<EmbyMusicArtist, EmbyMusicAlbum> &
  EmbyMixin;
export type EmbyMusicVideo = MusicVideo & EmbyMixin;
export type EmbyOtherVideo = OtherVideo & EmbyMixin;

export type EmbyItem =
  | EmbyMovie
  | EmbyShow
  | EmbySeason
  | EmbyEpisode
  | EmbyMusicArtist
  | EmbyMusicTrack
  | EmbyMusicAlbum
  | EmbyMusicVideo
  | EmbyOtherVideo
  | Folder;
