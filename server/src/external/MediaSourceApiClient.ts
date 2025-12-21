import type { ProgramType } from '../db/schema/Program.ts';
import type { ProgramGroupingType } from '../db/schema/ProgramGrouping.ts';
import type {
  Episode,
  Movie,
  MusicAlbum,
  MusicArtist,
  MusicTrack,
  Season,
  Show,
} from '../types/Media.ts';
import type { ApiClientOptions, QueryResult } from './BaseApiClient.ts';
import { BaseApiClient } from './BaseApiClient.ts';

export type ProgramTypeMap<
  MovieType extends Movie = Movie,
  ShowType extends Show = Show,
  SeasonType extends Season<ShowType> = Season<ShowType>,
  EpisodeType extends Episode<ShowType, SeasonType> = Episode<
    ShowType,
    SeasonType
  >,
  ArtistType extends MusicArtist = MusicArtist,
  AlbumType extends MusicAlbum<ArtistType> = MusicAlbum<ArtistType>,
  TrackType extends MusicTrack<ArtistType, AlbumType> = MusicTrack<
    ArtistType,
    AlbumType
  >,
> = {
  [ProgramType.Movie]: MovieType;
  [ProgramGroupingType.Show]: ShowType;
  [ProgramGroupingType.Season]: SeasonType;
  [ProgramType.Episode]: EpisodeType;
  [ProgramGroupingType.Artist]: ArtistType;
  [ProgramGroupingType.Album]: AlbumType;
  [ProgramType.Track]: TrackType;
};

export type ExtractMediaType<
  Client extends MediaSourceApiClient,
  Key extends keyof ProgramTypeMap,
> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Client extends MediaSourceApiClient<infer ProgramMapType, any>
    ? ProgramMapType[Key]
    : never;

export type ExtractShowType<Client extends MediaSourceApiClient> =
  ExtractMediaType<Client, 'show'> extends MusicArtist
    ? ExtractMediaType<Client, 'show'>
    : never;

export type MediaSourceApiClientFactory<
  Type extends MediaSourceApiClient,
  OptsType extends ApiClientOptions = Type extends MediaSourceApiClient<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any,
    infer Opts
  >
    ? Opts
    : ApiClientOptions,
> = (opts: OptsType) => Type;

export abstract class MediaSourceApiClient<
  ProgramTypes extends ProgramTypeMap = ProgramTypeMap,
  OptionsType extends ApiClientOptions = ApiClientOptions,
> extends BaseApiClient<OptionsType> {
  abstract getMovieLibraryContents(
    libraryId: string,
    pageSize?: number,
  ): AsyncIterable<ProgramTypes['movie']>;

  abstract getMovie(
    externalKey: string,
  ): Promise<QueryResult<ProgramTypes['movie']>>;

  abstract getTvShowLibraryContents(
    libraryId: string,
    pageSize?: number,
  ): AsyncIterable<ProgramTypes['show']>;

  abstract getShow(
    externalKey: string,
  ): Promise<QueryResult<ProgramTypes['show']>>;

  abstract getShowSeasons(
    externalKey: string,
    pageSize?: number,
  ): AsyncIterable<ProgramTypes['season']>;

  abstract getSeasonEpisodes(
    showId: string,
    seasonId: string,
    pageSize?: number,
    materializeFull?: boolean,
  ): AsyncIterable<ProgramTypes['episode']>;

  abstract getSeason(
    externalKey: string,
  ): Promise<QueryResult<ProgramTypes['season']>>;

  abstract getEpisode(
    externalKey: string,
  ): Promise<QueryResult<ProgramTypes['episode']>>;

  abstract getMusicLibraryContents(
    libraryId: string,
    pageSize: number,
  ): AsyncIterable<ProgramTypes['artist']>;

  abstract getArtistAlbums(
    artistKey: string,
    pageSize: number,
  ): AsyncIterable<ProgramTypes['album']>;

  abstract getMusicArtist(
    artistKey: string,
  ): Promise<QueryResult<ProgramTypes['artist']>>;

  abstract getMusicAlbum(
    artistKey: string,
  ): Promise<QueryResult<ProgramTypes['album']>>;

  abstract getAlbumTracks(
    albumKey: string,
    pageSize: number,
  ): AsyncIterable<ProgramTypes['track']>;

  abstract getMusicTrack(
    key: string,
  ): Promise<QueryResult<ProgramTypes['track']>>;
}
