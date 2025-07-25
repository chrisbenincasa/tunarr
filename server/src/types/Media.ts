/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Resolution } from '@tunarr/types';
import type { ExternalIdType } from '@tunarr/types/schemas';
import type dayjs from 'dayjs';
import type { Duration } from 'dayjs/plugin/duration.js';
import type { MediaSourceType } from '../db/schema/MediaSource.ts';
import type { ProgramType } from '../db/schema/Program.ts';
import type { ProgramGroupingType } from '../db/schema/ProgramGrouping.ts';
import type { Nullable } from './util.ts';

export interface NamedEntity {
  name: string;
  externalId?: string;
}

export type Actor = NamedEntity & {
  role?: string;
};
export type Writer = NamedEntity;
export type Director = NamedEntity;
export type Genre = NamedEntity;
export type Studio = NamedEntity;

export type MediaStreamTypes = {
  Video: 'video';
  Audio: 'audio';
  Subtitles: 'subtitles';
  Attachment: 'attachment';
  ExternalSubtitles: 'external_subtitles';
};

export type MediaStreamType = MediaStreamTypes[keyof MediaStreamTypes];

export interface MediaStream {
  // ID?
  index: number;
  codec: string;
  profile: string;
  streamType: MediaStreamType;
  languageCodeISO6392?: string;
  channels?: number; // Audio only
  title?: string; // ???
  default?: boolean;
  hasAttachedPicture?: boolean;
  pixelFormat?: string;
  bitDepth?: number;
  fileName?: string;
  mimeType?: string;
  // Is the stream selected based on the source preferences
  selected?: boolean;
}

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

export type MediaItem = {
  streams: MediaStream[];
  duration: Duration;
  sampleAspectRatio: string;
  displayAspectRatio: string;
  frameRate?: string; // either number or fractional
  // scan kind
  resolution?: Resolution;
  // width: number;
  // height: number;
  locations: MediaLocation[];
};

interface ItemBase {
  // Assign an internal ID immediately.
  uuid: string;
  canonicalId: string;
  type: ProgramType | ProgramGroupingType;
  identifiers: Identifier[];
  title: string;
  tags: string[];
}

export interface Program extends ItemBase {
  // metadata
  type: ProgramType;
  title: string;
  originalTitle: Nullable<string>;
  year: Nullable<number>;
  releaseDate: Nullable<dayjs.Dayjs>;

  // media
  mediaItem: MediaItem;

  // joins
  actors: Actor[];
  writers: Writer[];
  directors: Director[];
  genres: Genre[];
  studios: Studio[];
}

interface WithSummaryMetadata {
  summary: Nullable<string>;
  plot: Nullable<string>;
  tagline: Nullable<string>;
}

export interface Identifier {
  id: string;
  sourceId?: string;
  type: ExternalIdType;
}

export interface Movie extends Program, WithSummaryMetadata {
  type: typeof ProgramType.Movie;
  rating: Nullable<string>;
}

export interface Show extends ItemBase, WithSummaryMetadata {
  type: typeof ProgramGroupingType.Show;
  rating: Nullable<string>;
  year: Nullable<number>;
  releaseDate: Nullable<dayjs.Dayjs>;
  genres: Genre[];
  actors: Actor[];
  studios: Studio[];

  // Joins
  // seasons?: Season[];
}

export interface Season<ShowT extends Show = Show>
  extends ItemBase,
    WithSummaryMetadata {
  type: typeof ProgramGroupingType.Season;
  summary: Nullable<string>;
  studios: Studio[];
  index: number;
  year: Nullable<number>;
  releaseDate: Nullable<dayjs.Dayjs>;

  // joins
  show?: ShowT;
  // episodes?: Episode[];
}

export interface Episode<
  ShowT extends Show = Show,
  SeasonT extends Season<ShowT> = Season<ShowT>,
> extends Program {
  type: typeof ProgramType.Episode;
  episodeNumber: number;
  summary: Nullable<string>;
  season?: SeasonT;
}

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
> = EpisodeT & { season: SeasonT & { show: ShowT } };

export type EpisodeWithAncestors<
  ShowT extends Show = Show,
  SeasonT extends Season<ShowT> = Season<ShowT>,
  EpisodeT extends Episode<ShowT, SeasonT> = Episode<ShowT, SeasonT>,
> = EpisodeT & {
  season: SeasonT & {
    show: ShowT;
  };
};

export interface MusicArtist extends ItemBase, WithSummaryMetadata {
  type: typeof ProgramGroupingType.Artist;
  rating: Nullable<string>;
  year: Nullable<number>;
  // releaseDate: Nullable<dayjs.Dayjs>;
  genres: Genre[];
  // actors: Actor[];
  // studios: Studio[];

  // TODO: add Mood and Style
  // Joins
  // seasons?: Season[];
}

export interface MusicAlbum<ArtistT extends MusicArtist = MusicArtist>
  extends ItemBase,
    WithSummaryMetadata {
  type: typeof ProgramGroupingType.Album;
  summary: Nullable<string>;
  studios: Studio[];
  index: number;
  year: Nullable<number>;
  releaseDate: Nullable<dayjs.Dayjs>;
  genres: Genre[];

  // joins
  artist?: ArtistT;
  // episodes?: Episode[];
}

export interface MusicTrack<
  ArtistT extends MusicArtist = MusicArtist,
  AlbumT extends MusicAlbum<ArtistT> = MusicAlbum<ArtistT>,
> extends Program {
  type: typeof ProgramType.Track;
  trackNumber: number;
  // summary: Nullable<string>;
  year: Nullable<number>;
  album?: AlbumT;
}

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
> = TrackT & { album: AlbumT & { artist: ArtistT } };

export type AnyProgram = Movie | Episode;

export type HasMediaSourceInfo = {
  sourceType: MediaSourceType;
  externalKey: string;
};

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

export interface MediaSourceMusicArtist
  extends MusicArtist,
    HasMediaSourceInfo {}
export type MediaSourceMusicAlbum<ArtistT extends MusicArtist = MusicArtist> =
  MusicAlbum<ArtistT> & HasMediaSourceInfo;
export type MediaSourceMusicTrack<
  ArtistT extends MusicArtist = MusicArtist,
  AlbumT extends MusicAlbum<ArtistT> = MusicAlbum<ArtistT>,
  TrackT extends MusicTrack<ArtistT, AlbumT> = MusicTrack<ArtistT, AlbumT>,
> = TrackT & HasMediaSourceInfo;

interface PlexMixin extends HasMediaSourceInfo {
  sourceType: typeof MediaSourceType.Plex;
}

export interface PlexMovie extends Movie, PlexMixin {}
export interface PlexShow extends Show, PlexMixin {}
export interface PlexSeason extends Season<PlexShow>, PlexMixin {}
export interface PlexEpisode extends Episode<PlexShow, PlexSeason>, PlexMixin {}
export interface PlexArtist extends MusicArtist, PlexMixin {}
export interface PlexAlbum extends MusicAlbum<PlexArtist>, PlexMixin {}
export interface PlexTrack
  extends MusicTrack<PlexArtist, PlexAlbum>,
    PlexMixin {}

interface JellyfinMixin extends HasMediaSourceInfo {
  sourceType: typeof MediaSourceType.Jellyfin;
}

export interface JellyfinMovie extends Movie, JellyfinMixin {}
export interface JellyfinShow extends Show, JellyfinMixin {}
export interface JellyfinSeason extends Season<JellyfinShow>, JellyfinMixin {}
export interface JellyfinEpisode
  extends Episode<JellyfinShow, JellyfinSeason>,
    JellyfinMixin {}

export interface JellyfinMusicArtist extends MusicArtist, JellyfinMixin {}
export interface JellyfinMusicAlbum
  extends MusicAlbum<JellyfinMusicArtist>,
    JellyfinMixin {}
export interface JellyfinMusicTrack
  extends MusicTrack<JellyfinMusicArtist, JellyfinMusicAlbum>,
    JellyfinMixin {}
