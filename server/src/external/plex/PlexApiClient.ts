import { MediaSourceType } from '@/db/schema/base.js';
import type { MediaSourceLibraryOrm } from '@/db/schema/MediaSourceLibrary.js';
import type { Nilable, Nullable } from '@/types/util.js';
import { type Maybe } from '@/types/util.js';
import dayjs from '@/util/dayjs.js';
import {
  caughtErrorToError,
  inConstArr,
  isDefined,
  isNonEmptyString,
  zipWithIndex,
} from '@/util/index.js';
import { getTunarrVersion } from '@/util/version.js';
import { PlexClientIdentifier } from '@tunarr/shared/constants';
import { seq } from '@tunarr/shared/util';
import type {
  Actor,
  Collection,
  Director,
  Library,
  MediaArtwork,
  MediaChapter,
  NamedEntity,
  Playlist,
  ProgramOrFolder,
  Writer,
} from '@tunarr/types';
import type { MediaSourceStatus, PagedResult } from '@tunarr/types/api';
import type {
  PlexEpisode as ApiPlexEpisode,
  PlexMovie as ApiPlexMovie,
  PlexMusicAlbum as ApiPlexMusicAlbum,
  PlexMusicArtist as ApiPlexMusicArtist,
  PlexMusicTrack as ApiPlexMusicTrack,
  PlexTvSeason as ApiPlexTvSeason,
  PlexTvShow as ApiPlexTvShow,
  PlexActor,
  PlexJoinItem,
  PlexMediaAudioStream,
  PlexMediaContainerMetadata,
  PlexMediaContainerResponse,
  PlexMediaNoCollectionOrPlaylist,
  PlexMediaNoCollectionPlaylist,
  PlexMediaVideoStream,
  PlexTerminalMedia,
} from '@tunarr/types/plex';
import {
  MakePlexMediaContainerResponseSchema,
  PlexContainerStatsSchema,
  type PlexDvr,
  type PlexDvrsResponse,
  PlexEpisodeSchema,
  PlexFilterMediaContainerResponseSchema,
  PlexGenericMediaContainerResponseSchema,
  PlexLibrariesResponseSchema,
  PlexLibraryCollectionSchema,
  type PlexMedia,
  PlexMediaContainerResponseSchema,
  PlexMediaNoCollectionPlaylistResponse,
  type PlexMetadataResponse,
  PlexMovieMediaContainerResponseSchema,
  PlexMusicAlbumSchema,
  PlexMusicArtistSchema,
  PlexMusicTrackSchema,
  PlexPlaylistSchema,
  type PlexResource,
  PlexTagResultSchema,
  PlexTvSeasonSchema,
  PlexTvShowSchema,
  PlexUserSchema,
} from '@tunarr/types/plex';
import {
  type AxiosRequestConfig,
  isAxiosError,
  type RawAxiosRequestHeaders,
} from 'axios';
import { XMLParser } from 'fast-xml-parser';
import {
  compact,
  filter,
  find,
  first,
  forEach,
  isEmpty,
  isError,
  isNil,
  isUndefined,
  map,
  maxBy,
  orderBy,
  sortBy,
} from 'lodash-es';
import { match, P } from 'ts-pattern';
import { v4 } from 'uuid';
import type z from 'zod';
import type { PageParams } from '../../db/interfaces/IChannelDB.ts';
import type { ArtworkType } from '../../db/schema/Artwork.ts';
import { ProgramType, ProgramTypes } from '../../db/schema/Program.ts';
import { ProgramGroupingType } from '../../db/schema/ProgramGrouping.ts';
import type { Canonicalizer } from '../../services/Canonicalizer.ts';
import type { WrappedError } from '../../types/errors.ts';
import type {
  MediaItem,
  MediaStream,
  PlexAlbum,
  PlexArtist,
  PlexEpisode,
  PlexItem,
  PlexMovie,
  PlexOtherVideo,
  PlexSeason,
  PlexShow,
  PlexTrack,
} from '../../types/Media.js';
import { Result } from '../../types/result.ts';
import { parsePlexGuid } from '../../util/externalIds.ts';
import iterators from '../../util/iterator.ts';
import { titleToSortTitle } from '../../util/programs.ts';
import type { ApiClientOptions } from '../BaseApiClient.js';
import { QueryError, type QueryResult } from '../BaseApiClient.js';
import { MediaSourceApiClient } from '../MediaSourceApiClient.ts';
import { PlexQueryCache } from './PlexQueryCache.js';
import { PlexRequestRedacter } from './PlexRequestRedacter.ts';

const PlexCache = new PlexQueryCache();

const PlexHeaders = {
  'X-Plex-Product': 'Tunarr',
  'X-Plex-Client-Identifier': PlexClientIdentifier,
};

type PlexTypes = {
  [ProgramType.Movie]: PlexMovie;
  [ProgramGroupingType.Show]: PlexShow;
  [ProgramGroupingType.Season]: PlexSeason;
  [ProgramType.Episode]: PlexEpisode;
  [ProgramGroupingType.Artist]: PlexArtist;
  [ProgramGroupingType.Album]: PlexAlbum;
  [ProgramType.Track]: PlexTrack;
};

export type PlexApiClientFactory = (opts: ApiClientOptions) => PlexApiClient;

export class PlexApiClient extends MediaSourceApiClient<PlexTypes> {
  protected redacter = new PlexRequestRedacter();

  constructor(
    private canonicalizer: Canonicalizer<PlexMedia>,
    opts: ApiClientOptions,
  ) {
    super({
      ...opts,
      extraHeaders: {
        ...PlexHeaders,
        'X-Plex-Version': getTunarrVersion(),
        'X-Plex-Token': opts.mediaSource.accessToken,
      },
      queueOpts: {
        concurrency: 5,
        interval: dayjs.duration({ seconds: 1 }),
      },
    });
  }

  get serverName() {
    return this.options.mediaSource.name;
  }

  get serverId() {
    return this.options.mediaSource.uuid;
  }

  getFullUrl(path: string): string {
    const url = super.getFullUrl(path);
    const parsed = new URL(url);
    parsed.searchParams.set(
      'X-Plex-Token',
      this.options.mediaSource.accessToken,
    );
    return parsed.toString();
  }

  // TODO: make all callers use this
  private async doGetResult<T extends PlexMediaContainerMetadata>(
    path: string,
    config: Partial<Omit<AxiosRequestConfig, 'method' | 'url'>> = {},
    skipCache: boolean = false,
  ): Promise<QueryResult<T>> {
    const getter = async (): Promise<QueryResult<T>> => {
      const req: AxiosRequestConfig = {
        method: 'get',
        url: path,
        headers: config.headers,
      };

      if (this.options.mediaSource.accessToken === '') {
        throw new Error(
          'No Plex token provided. Please use the SignIn method or provide a X-Plex-Token in the Plex constructor.',
        );
      }

      try {
        const res = await this.doRequest<PlexMediaContainerResponse<T>>(req);
        if (isUndefined(res?.MediaContainer)) {
          this.logger.error(res, 'Expected MediaContainer, got %O', res);
          return this.makeErrorResult('parse_error');
        }

        return this.makeSuccessResult(res?.MediaContainer);
      } catch (err) {
        if (isAxiosError(err) && err.response?.status === 404) {
          return this.makeErrorResult('not_found');
        }

        const error = caughtErrorToError(err);

        return this.makeErrorResult('generic_request_error', error.message);
      }
    };

    return this.options.enableRequestCache && !skipCache
      ? await PlexCache.getOrSetPlexResult<T>(
          this.options.mediaSource.name,
          path,
          getter,
        )
      : await getter();
  }

  // We're just keeping the old contract here right now...
  async doGetPath<T extends PlexMediaContainerMetadata>(
    path: string,
    optionalHeaders: RawAxiosRequestHeaders = {},
    skipCache: boolean = false,
  ): Promise<Maybe<T>> {
    const result = await this.doGetResult<T>(
      path,
      { headers: optionalHeaders },
      skipCache,
    );

    return result.orUndefined();
  }

  async getFilters(key: string) {
    return await this.doTypeCheckedGet(
      `/library/sections/${key}/all`,
      PlexFilterMediaContainerResponseSchema,
      {
        params: {
          includeMeta: '1',
          includeAdvanced: '1',
          'X-Plex-Container-Start': 0,
          'X-Plex-Container-Size': 0,
        },
      },
    ).then((res) => res.map((d) => d.MediaContainer));
  }

  async getTags(libraryKey: string, itemKey: string) {
    return await this.doTypeCheckedGet(
      `/library/sections/${libraryKey}/${itemKey}`,
      PlexTagResultSchema,
    );
  }

  getMovieLibraryContents(
    libraryId: string,
    pageSize: number = 50,
  ): AsyncIterable<PlexMovie> {
    return this.iterateChildItems(
      libraryId,
      PlexMovieMediaContainerResponseSchema,
      (movie, library) => this.plexMovieInjection(movie, library),
      pageSize,
    );
  }

  getTvShowLibraryContents(
    libraryId: string,
    pageSize: number = 50,
  ): AsyncGenerator<PlexShow> {
    return this.iterateChildItems(
      libraryId,
      MakePlexMediaContainerResponseSchema(PlexTvShowSchema),
      (show, library) => this.plexShowInjection(show, library),
      pageSize,
    );
  }

  getShowSeasons(tvShowKey: string, pageSize: number = 50) {
    return this.iterateChildItems(
      tvShowKey,
      MakePlexMediaContainerResponseSchema(PlexTvSeasonSchema),
      (season, library) => this.plexSeasonInjection(season, library),
      pageSize,
      `/library/metadata/${tvShowKey}/children`,
    );
  }

  getSeasonEpisodes(
    _: string,
    tvSeasonKey: string,
    pageSize: number = 50,
    materializeFull: boolean = false,
  ): AsyncIterable<PlexEpisode> {
    return this.iterateChildItems(
      tvSeasonKey,
      MakePlexMediaContainerResponseSchema(PlexEpisodeSchema),
      (ep, library) => this.plexEpisodeInjection(ep, library),
      pageSize,
      `/library/metadata/${tvSeasonKey}/children`,
      materializeFull ? (ep) => this.getEpisode(ep.ratingKey) : undefined,
    );
  }

  getMusicLibraryContents(
    libraryId: string,
    pageSize: number = 50,
  ): AsyncIterable<PlexArtist> {
    return this.iterateChildItems(
      libraryId,
      MakePlexMediaContainerResponseSchema(PlexMusicArtistSchema),
      (artist, library) => this.plexMusicArtistInjection(artist, library),
      pageSize,
    );
  }

  getArtistAlbums(
    artistKey: string,
    pageSize: number = 50,
  ): AsyncIterable<PlexAlbum> {
    return this.iterateChildItems(
      artistKey,
      MakePlexMediaContainerResponseSchema(PlexMusicAlbumSchema),
      (album, library) => this.plexAlbumInjection(album, library),
      pageSize,
      `/library/metadata/${artistKey}/children`,
    );
  }

  getAlbumTracks(
    albumKey: string,
    pageSize: number = 50,
  ): AsyncIterable<PlexTrack> {
    return this.iterateChildItems(
      albumKey,
      MakePlexMediaContainerResponseSchema(PlexMusicTrackSchema),
      (track, library) => this.plexTrackInjection(track, library),
      pageSize,
      `/library/metadata/${albumKey}/children`,
    );
  }

  async getMusicArtist(key: string): Promise<QueryResult<PlexArtist>> {
    const queryResult = await this.getItemMetadataInternal(
      key,
      MakePlexMediaContainerResponseSchema(PlexMusicArtistSchema),
    );

    return queryResult.flatMap((artist) =>
      this.findLibraryFromPlexMedia(artist)
        .flatMap((library) => this.plexMusicArtistInjection(artist, library))
        .mapError((e) => QueryError.genericQueryError(e.message)),
    );
  }

  async getMusicAlbum(key: string): Promise<QueryResult<PlexAlbum>> {
    const queryResult = await this.getItemMetadataInternal(
      key,
      MakePlexMediaContainerResponseSchema(PlexMusicAlbumSchema),
    );

    return queryResult.flatMap((album) =>
      this.findLibraryFromPlexMedia(album)
        .flatMap((library) => this.plexAlbumInjection(album, library))
        .mapError((e) => QueryError.genericQueryError(e.message)),
    );
  }

  async getMusicTrack(key: string): Promise<QueryResult<PlexTrack>> {
    const queryResult = await this.getItemMetadataInternal(
      key,
      MakePlexMediaContainerResponseSchema(PlexMusicTrackSchema),
    );

    return queryResult.flatMap((track) =>
      this.findLibraryFromPlexMedia(track)
        .flatMap((library) => this.plexTrackInjection(track, library))
        .mapError((e) => QueryError.genericQueryError(e.message)),
    );
  }

  private async *iterateChildItems<
    OutType,
    ItemType extends PlexMediaNoCollectionOrPlaylist,
  >(
    libraryId: string,
    schema: z.ZodType<PlexMetadataResponse<ItemType>>,
    converter: (
      item: ItemType,
      libraryId: MediaSourceLibraryOrm,
    ) => Result<OutType>,
    pageSize: number = 50,
    key: string = `/library/sections/${libraryId}/all`,
    materializeFull: Maybe<
      (item: ItemType) => Promise<QueryResult<OutType>>
    > = undefined,
  ): AsyncGenerator<OutType> {
    const count = await this.getChildCount(key);
    if (count.isFailure()) {
      throw count.error;
    }

    const totalPages = Math.ceil(count.get() / pageSize);
    for (let page = 0; page <= totalPages; page++) {
      const chunkResult = await this.doTypeCheckedGet(key, schema, {
        params: {
          'X-Plex-Container-Size': pageSize,
          'X-Plex-Container-Start': page * pageSize,
        },
      });

      if (chunkResult.isFailure()) {
        throw chunkResult.error;
      }

      const mediaContainer = chunkResult.get().MediaContainer;
      const responseLibraryId = mediaContainer.librarySectionID?.toString();
      for (const item of mediaContainer.Metadata ?? []) {
        const externalLibraryId =
          item.librarySectionID?.toString() ?? responseLibraryId ?? libraryId;
        const library = this.findLibraryFromPlexMedia(item, externalLibraryId);

        if (library.isFailure()) {
          this.logger.warn(
            'Could not find matching library for Plex library ID %s. Try resyncing Plex libraries.',
            externalLibraryId,
          );
          continue;
        }

        let converted: Result<OutType>;
        if (materializeFull) {
          const materialized = await materializeFull(item);
          if (materialized.isFailure()) {
            this.logger.warn(
              materialized.error,
              'Failed to materialize full child item: %s',
              item.ratingKey,
            );
            continue;
          }
          converted = materialized;
        } else {
          converted = converter(item, library.get());
        }

        if (converted.isFailure()) {
          this.logger.warn(
            converted.error,
            'Failed to convert Plex API item %s',
            item.ratingKey,
          );
          continue;
        }

        yield converted.get();
      }
    }

    return;
  }

  async getLibrariesRaw() {
    return this.doTypeCheckedGet(
      '/library/sections',
      PlexLibrariesResponseSchema,
    );
  }

  async getLibraries() {
    const result = await this.getLibrariesRaw();
    return result.mapPure((data) =>
      data.MediaContainer.Directory.map(
        (lib) =>
          ({
            type: 'library',
            externalId: lib.key,
            locations:
              lib.Location?.map((loc) => ({
                type: 'local',
                path: loc.path,
              })) ?? [],
            sourceType: 'plex',
            title: lib.title,
            uuid: v4(), // May get replaced later if we have a match
          }) satisfies Library,
      ),
    );
  }

  async getLibraryCollections(
    libraryId: string,
    paging?: PageParams,
  ): Promise<QueryResult<PagedResult<Collection[]>>> {
    const pageParams = paging
      ? {
          'X-Plex-Container-Start': paging.offset,
          'X-Plex-Container-Size': paging.limit,
        }
      : {};
    const result = await this.doTypeCheckedGet(
      `/library/sections/${libraryId}/collections`,
      MakePlexMediaContainerResponseSchema(PlexLibraryCollectionSchema),
      {
        params: {
          ...pageParams,
        },
      },
    );

    return result.flatMapPure<PagedResult<Collection[]>>((data) => {
      const library = this.options.mediaSource.libraries.find(
        (lib) => lib.externalKey === libraryId,
      );
      if (!library) {
        return this.makeErrorResult(
          'generic_request_error',
          `Could not find matching library in DB for key = ${libraryId}`,
        );
      }

      const collections = (data.MediaContainer.Metadata ?? []).map(
        (collection) =>
          ({
            type: 'collection',
            externalId: collection.ratingKey,
            libraryId: library.uuid,
            mediaSourceId: this.options.mediaSource.uuid,
            title: collection.title,
            uuid: v4(),
            sourceType: MediaSourceType.Plex,
            childCount: collection.childCount,
            childType: inConstArr(ProgramTypes, collection.subtype)
              ? (collection.subtype as Collection['childType'])
              : undefined,
          }) satisfies Collection,
      );

      return this.makeSuccessResult({
        size: collections.length,
        result: collections,
        total:
          data.MediaContainer.totalSize ??
          (isNil(paging?.offset) ? collections.length : 0),
        offset: paging?.offset,
      });
    });
  }

  async getLibraryCount(libraryId: string) {
    return this.getChildCount(`/library/sections/${libraryId}/all`);
  }

  async getItemChildCount(key: string) {
    return this.getChildCount(`/library/metadata/${key}/children`);
  }

  async getPlaylists(
    libraryId?: string,
    paging?: PageParams,
  ): Promise<QueryResult<PagedResult<Playlist[]>>> {
    const params = {};

    if (paging) {
      params['X-Plex-Container-Start'] = paging.offset;
      params['X-Plex-Container-Size'] = paging.limit;
    }

    if (libraryId) {
      params['sectionID'] = libraryId;
      params['type'] = '15';
    }

    const result = await this.doTypeCheckedGet(
      '/playlists',
      MakePlexMediaContainerResponseSchema(PlexPlaylistSchema),
      {
        params,
      },
    );

    return result.mapPure((data) => {
      const playlists = (data.MediaContainer.Metadata ?? []).map(
        (playlist) =>
          ({
            externalId: playlist.ratingKey,
            libraryId: '',
            mediaSourceId: this.options.mediaSource.uuid,
            sourceType: this.options.mediaSource.type,
            title: playlist.title,
            type: 'playlist',
            uuid: v4(),
            childCount: playlist.leafCount,
          }) satisfies Playlist,
      );

      return {
        result: playlists,
        size: playlists.length,
        total: data.MediaContainer.totalSize ?? playlists.length,
        offset: paging?.offset,
      };
    });
  }

  private getChildCount(key: string) {
    return this.doTypeCheckedGet(key, PlexContainerStatsSchema, {
      params: {
        'X-Plex-Container-Size': 0,
        'X-Plex-Container-Start': 0,
      },
    }).then((result) =>
      result.map(
        (stats) => stats.MediaContainer.totalSize ?? stats?.MediaContainer.size,
      ),
    );
  }

  private async getItemMetadataInternal<ItemType>(
    key: string,
    schema: z.ZodType<PlexMetadataResponse<ItemType>>,
  ): Promise<QueryResult<ItemType>> {
    const responseResult = await this.doTypeCheckedGet(
      `/library/metadata/${key}`,
      schema,
      {
        params: {
          includeMarkers: 1,
          includeChapters: 1,
          includeChildren: 1,
          includeLoudnessRamps: 1,
          includeExtras: 1,
        },
      },
    );

    return responseResult
      .flatMap<ItemType>((parsedResponse) => {
        const media = first(parsedResponse.MediaContainer.Metadata);
        if (!isUndefined(media)) {
          return this.makeSuccessResult<ItemType>(media);
        }
        this.logger.error(
          'Could not extract Metadata object for Plex media, key = %s',
          key,
        );
        return this.makeErrorResult('parse_error');
      })
      .mapError((e) =>
        QueryError.isQueryError(e)
          ? e
          : QueryError.genericQueryError(e.message),
      );
  }

  async getItemMetadata(key: string): Promise<QueryResult<PlexMedia>> {
    return this.getItemMetadataInternal(key, PlexMediaContainerResponseSchema);
  }

  async getMovie(key: string): Promise<QueryResult<PlexMovie>> {
    return this.getMediaOfType(
      key,
      PlexMovieMediaContainerResponseSchema,
      (movie, library) => this.plexMovieInjection(movie, library),
    );
  }

  async getVideo(key: string): Promise<QueryResult<PlexOtherVideo>> {
    return this.getMediaOfType(
      key,
      PlexMediaNoCollectionPlaylistResponse,
      (video, library) => {
        if (video.type !== 'movie' || video.subtype !== 'clip') {
          return this.makeErrorResult(
            'generic_request_error',
            `Got unexpected Plex item of type ${video.type} (subtype = ${video.type === 'movie' ? video.subtype : 'none'})`,
          );
        }
        return this.plexOtherVideoInjection(video, library);
      },
    );
  }

  async getShow(externalKey: string): Promise<QueryResult<PlexShow>> {
    return this.getMediaOfType(
      externalKey,
      MakePlexMediaContainerResponseSchema(PlexTvShowSchema),
      (show, library) => this.plexShowInjection(show, library),
    );
  }

  private async getMediaOfType<
    ItemType extends PlexMediaNoCollectionOrPlaylist,
    OutType,
  >(
    externalKey: string,
    schema: z.ZodType<PlexMetadataResponse<ItemType>>,
    converter: (
      plexItem: ItemType,
      library: MediaSourceLibraryOrm,
    ) => Result<OutType>,
  ): Promise<QueryResult<OutType>> {
    const queryResult = await this.getItemMetadataInternal(externalKey, schema);
    return queryResult.flatMap((show) => {
      return this.findLibraryFromPlexMedia(show).flatMap((library) =>
        converter(show, library).ifNil(
          QueryError.create(
            'generic_request_error',
            `Could not convert Plex show ID = ${externalKey}`,
          ),
        ),
      );
    });
  }

  private findLibraryFromPlexMedia(
    media: PlexMediaNoCollectionOrPlaylist,
    libraryId?: string,
  ): QueryResult<MediaSourceLibraryOrm> {
    libraryId ??= media.librarySectionID?.toString();
    if (!isNonEmptyString(libraryId)) {
      return this.makeErrorResult(
        'generic_request_error',
        `Missing librarySectionID for Plex show ${media.ratingKey}`,
      );
    }

    const library = this.findMatchingLibrary(libraryId);

    if (!library) {
      return this.makeErrorResult(
        'generic_request_error',
        `Could not find matching library for Plex library ID ${libraryId}. Try syncing your libraries!`,
      );
    }

    return this.makeSuccessResult(library);
  }

  async getSeason(key: string): Promise<QueryResult<PlexSeason>> {
    return this.getMediaOfType(
      key,
      MakePlexMediaContainerResponseSchema(PlexTvSeasonSchema),
      (season, library) => this.plexSeasonInjection(season, library),
    );
  }

  async getEpisode(key: string): Promise<QueryResult<PlexEpisode>> {
    return this.getMediaOfType(
      key,
      MakePlexMediaContainerResponseSchema(PlexEpisodeSchema),
      (episode, library) => this.plexEpisodeInjection(episode, library),
    );
  }

  async search(
    key: string,
    pageParam: Maybe<{ offset: number; limit: number }>,
    searchParam: Maybe<string>,
    parent: Maybe<string>,
  ): Promise<Result<PagedResult<PlexItem[]>>> {
    const mediaSourceId = this.options.mediaSource.uuid;
    if (!mediaSourceId) {
      return Result.forError(
        new Error('Cannot request this resource without a mediaSourceId'),
      );
    }

    const plexQuery = new URLSearchParams();

    if (!isUndefined(pageParam)) {
      plexQuery.set('X-Plex-Container-Start', pageParam.offset.toString());
      plexQuery.set('X-Plex-Container-Size', pageParam.limit.toString());
    }

    // We cannot search when scoped to a parent
    if (isEmpty(parent)) {
      // HACK for now
      forEach(searchParam?.split('&'), (keyval) => {
        const idx = keyval.lastIndexOf('=');
        if (idx !== -1) {
          plexQuery.append(keyval.substring(0, idx), keyval.substring(idx + 1));
        }
      });
    }

    const path = match(parent)
      .with('collection', () => `/library/collections/${key}/children`)
      .with('playlist', () => `/playlists/${key}/items`)
      .with(P.nonNullable, () => {
        plexQuery.append('excludeAllLeaves', '1');
        return `/library/metadata/${key}/children`;
      })
      .otherwise(() => `/library/sections/${key}/all`);

    const result = await this.doTypeCheckedGet(
      path,
      PlexMediaNoCollectionPlaylistResponse,
      {
        params: plexQuery.entries().reduce(
          (acc, [key, val]) => {
            acc[key] = val;
            return acc;
          },
          {} as Record<string, string>,
        ),
      },
    );

    return result.map((data) => {
      const items = seq.collect(data.MediaContainer.Metadata, (m) =>
        this.convertPlexResponse(
          m,
          m.librarySectionID?.toString() ??
            data.MediaContainer.librarySectionID?.toString(),
        ),
      );

      return {
        total: data.MediaContainer.totalSize ?? -1,
        result: items,
        size: items.length,
      };
    });
  }

  async getItemChildren(
    key: string,
    itemType: 'item' | 'collection' | 'playlist',
  ): Promise<Result<ProgramOrFolder[]>> {
    const mediaSourceId = this.options.mediaSource.uuid;
    if (!mediaSourceId) {
      return Result.forError(
        new Error('Cannot request this resource without a mediaSourceId'),
      );
    }

    const path = match(itemType)
      .with('collection', () => `/library/collections/${key}/children`)
      .with('playlist', () => `/playlists/${key}/items`)
      .with('item', () => `/library/metadata/${key}/children`)
      .exhaustive();

    const response = await this.doTypeCheckedGet(
      path,
      PlexMediaNoCollectionPlaylistResponse,
      {
        params: {
          includeChapters: 1,
          includeMarkers: 1,
          includeElements: [
            'Media',
            'Part',
            'Stream',
            'Genre',
            'Rating',
            'Collection',
            'Director',
            'Writer',
            'Role',
            'Producer',
          ].join(','),
        },
      },
    );

    return response.map((data) => {
      return seq.collect(data.MediaContainer.Metadata, (m) =>
        this.convertPlexResponse(
          m,
          m.librarySectionID?.toString() ??
            data.MediaContainer.librarySectionID?.toString(),
        ),
      );
    });
  }

  getOtherVideosLibraryContents(
    parentId: string,
  ): AsyncIterable<PlexOtherVideo> {
    const generator = this.iterateChildItems(
      parentId,
      PlexMediaNoCollectionPlaylistResponse,
      (item, lib) => {
        if (item.type !== 'movie' || item.subtype !== 'clip') {
          return Result.success(null);
        }
        return this.plexOtherVideoInjection(item, lib);
      },
    );
    return iterators.compact(generator);
  }

  private convertPlexResponse(
    item: z.infer<typeof PlexMediaNoCollectionPlaylist>,
    externalLibraryId: Maybe<string>,
  ): Nullable<PlexItem> {
    const library = externalLibraryId
      ? this.findMatchingLibrary(externalLibraryId)
      : null;
    if (!library) {
      return null;
    }

    const result = match(item)
      .returnType<Result<PlexItem>>()
      .with({ type: 'album' }, (album) =>
        this.plexAlbumInjection(album, library),
      )
      .with({ type: 'artist' }, (artist) =>
        this.plexMusicArtistInjection(artist, library),
      )
      .with({ type: 'episode' }, (ep) => this.plexEpisodeInjection(ep, library))
      .with({ type: 'season' }, (season) =>
        this.plexSeasonInjection(season, library),
      )
      .with({ type: 'show' }, (show) => this.plexShowInjection(show, library))
      .with({ type: 'movie' }, (movie) =>
        this.plexMovieInjection(movie, library),
      )
      .with({ type: 'track' }, (track) =>
        this.plexTrackInjection(track, library),
      )
      .exhaustive();
    if (result.isFailure()) {
      this.logger.warn(result.error, `Unable to convert Plex item: %O`, item);
      return null;
    }
    return result.get();
  }

  async getSubtitles(key: string): Promise<QueryResult<string>> {
    try {
      const subtitlesResult = await this.doGet<string>({
        url: key,
      });

      return this.makeSuccessResult(subtitlesResult);
    } catch (e) {
      const err = caughtErrorToError(e);
      return this.makeErrorResult('generic_request_error', err.message);
    }
  }

  async checkServerStatus(): Promise<MediaSourceStatus> {
    try {
      const result = await this.doTypeCheckedGet(
        '/',
        PlexGenericMediaContainerResponseSchema,
      );

      if (result.isFailure()) {
        throw result.error;
      } else if (isUndefined(result)) {
        // Parse error - indicates that the URL is probably not a Plex server
        return {
          healthy: false,
          status: 'bad_response',
        };
      }

      return {
        healthy: true,
      };
    } catch (err) {
      return {
        healthy: false,
        status: this.getHealthStatus(err),
      } satisfies MediaSourceStatus;
    }
  }

  async getUser() {
    return this.doTypeCheckedGet('/api/v2/user', PlexUserSchema, {
      baseURL: 'https://clients.plex.tv',
    });
  }

  async getDvrs() {
    try {
      const result = await this.doGetPath<PlexDvrsResponse>('/livetv/dvrs');
      return result?.Dvr ?? [];
    } catch (err) {
      this.logger.error(err, 'GET /livetv/drs failed');
      throw err;
    }
  }

  async getResources() {}

  async refreshGuide(_dvrs?: PlexDvr[]) {
    const dvrs = !isUndefined(_dvrs) ? _dvrs : await this.getDvrs();
    if (!dvrs) {
      throw new Error('Could not retrieve Plex DVRs');
    }

    for (const dvr of dvrs) {
      await this.doPost({ url: `/livetv/dvrs/${dvr.key}/reloadGuide` });
    }
  }

  async getDevices(): Promise<Maybe<PlexTvDevicesResponse>> {
    const response = await this.doRequest<string>({
      method: 'get',
      baseURL: 'https://plex.tv',
      url: '/devices.xml',
    });

    if (isError(response)) {
      this.logger.error(response);
      return;
    }

    const parsed = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
    }).parse(response) as PlexTvDevicesResponse;
    return parsed;
  }

  getThumbUrl(opts: {
    itemKey: string;
    width?: number;
    height?: number;
    upscale?: string;
    imageType: 'poster' | 'background';
  }) {
    return PlexApiClient.getImageUrl({
      uri: this.options.mediaSource.uri,
      accessToken: this.options.mediaSource.accessToken,
      itemKey: opts.itemKey,
      width: opts.width,
      height: opts.height,
      upscale: opts.upscale,
      imageType: opts.imageType,
    });
  }

  setEnableRequestCache(enable: boolean) {
    this.options.enableRequestCache = enable;
  }

  protected override preRequestValidate<T>(
    req: AxiosRequestConfig,
  ): Maybe<QueryResult<T>> {
    if (isEmpty(this.options.mediaSource.accessToken)) {
      return Result.failure(
        QueryError.create(
          'no_access_token',
          'No Plex token provided. Please use the SignIn method or provide a X-Plex-Token in the Plex constructor.',
        ),
      );
    }
    return super.preRequestValidate(req);
  }

  static getImageUrl(opts: {
    uri: string;
    accessToken: string;
    itemKey: string;
    width?: number;
    height?: number;
    upscale?: string;
    imageType: 'poster' | 'background';
  }): string {
    const {
      uri,
      accessToken,
      itemKey,
      width,
      height,
      upscale,
      imageType = 'poster',
    } = opts;
    const cleanKey = itemKey.replaceAll(/\/library\/metadata\//g, '');
    const path = match(imageType)
      .with('poster', () => 'thumb')
      .with('background', () => 'art')
      .exhaustive();

    let thumbUrl: URL;
    const key = `/library/metadata/${cleanKey}/${path}?X-Plex-Token=${accessToken}`;
    if (isUndefined(height) || isUndefined(width)) {
      thumbUrl = new URL(`${uri}${key}`);
    } else {
      thumbUrl = new URL(`${uri}/photo/:/transcode`);
      thumbUrl.searchParams.append('url', key);
      thumbUrl.searchParams.append('X-Plex-Token', accessToken);
      thumbUrl.searchParams.append('width', width.toString());
      thumbUrl.searchParams.append('height', height.toString());
      thumbUrl.searchParams.append('upscale', (upscale ?? '1').toString());
    }
    return thumbUrl.toString();
  }

  private plexShowInjection(
    plexShow: ApiPlexTvShow,
    mediaLibrary: MediaSourceLibraryOrm,
  ): Result<PlexShow> {
    const artwork: MediaArtwork[] = compact([
      this.plexArtworkInject(plexShow.thumb, 'poster'),
      this.plexArtworkInject(plexShow.art, 'banner'),
    ]);

    return Result.success({
      uuid: v4(),
      canonicalId: this.canonicalizer.getCanonicalId(plexShow),
      mediaSourceId: this.options.mediaSource.uuid,
      libraryId: mediaLibrary.uuid,
      sourceType: MediaSourceType.Plex,
      title: plexShow.title,
      type: ProgramGroupingType.Show,
      year: plexShow.year ?? null,
      releaseDate: plexShow.originallyAvailableAt
        ? Result.attempt(
            () => +dayjs(plexShow.originallyAvailableAt, 'YYYY-MM-DD'),
          ).orNull()
        : null,
      releaseDateString: plexShow.originallyAvailableAt ?? null,
      actors: plexActorInject(plexShow.Role),
      genres: plexJoinItemInject(plexShow.Genre),
      plot: plexShow.summary ?? null,
      studios: isNonEmptyString(plexShow.studio)
        ? [{ name: plexShow.studio }]
        : [],
      rating: plexShow.contentRating ?? null,
      summary: null,
      tagline: plexShow.tagline ?? null,
      identifiers: [
        {
          type: 'plex',
          id: plexShow.ratingKey,
          sourceId: this.options.mediaSource.uuid,
        },
        {
          type: 'plex-guid',
          id: plexShow.guid,
        },
        ...seq.collect(plexShow.Guid, (guid) => {
          const parsed = parsePlexGuid(guid.id);
          if (!parsed) return;
          return {
            id: parsed.externalKey,
            type: parsed.sourceType,
          };
        }),
      ],
      tags: [],
      externalId: plexShow.ratingKey,
      childCount: plexShow.childCount,
      grandchildCount: plexShow.leafCount,
      sortTitle: titleToSortTitle(plexShow.title),
      artwork,
    } satisfies PlexShow);
  }

  private plexSeasonInjection(
    plexSeason: ApiPlexTvSeason,
    mediaLibrary: MediaSourceLibraryOrm,
  ): Result<PlexSeason> {
    return Result.success({
      uuid: v4(),
      canonicalId: this.canonicalizer.getCanonicalId(plexSeason),
      mediaSourceId: this.options.mediaSource.uuid,
      libraryId: mediaLibrary.uuid,
      sourceType: MediaSourceType.Plex,
      title: plexSeason.title,
      sortTitle: titleToSortTitle(plexSeason.title),
      type: ProgramGroupingType.Season,
      index: plexSeason.index ?? 1, // Not great
      releaseDate: null,
      releaseDateString: null,
      plot: plexSeason.summary ?? null,
      studios: isNonEmptyString(plexSeason.parentStudio)
        ? [{ name: plexSeason.parentStudio }]
        : [],
      summary: null,
      tagline: null,
      year: null,
      identifiers: [
        {
          type: 'plex',
          id: plexSeason.ratingKey,
          sourceId: this.options.mediaSource.uuid,
        },
        {
          type: 'plex-guid',
          id: plexSeason.guid,
        },
        ...seq.collect(plexSeason.Guid, (guid) => {
          const parsed = parsePlexGuid(guid.id);
          if (!parsed) return;
          return {
            id: parsed.externalKey,
            type: parsed.sourceType,
          };
        }),
      ],
      tags: [],
      externalId: plexSeason.ratingKey,
      childCount: plexSeason.leafCount,
      artwork: compact([
        this.plexArtworkInject(plexSeason.thumb, 'poster'),
        this.plexArtworkInject(plexSeason.art, 'banner'),
      ]),
      show: plexSeason.parentRatingKey
        ? ({
            sortTitle: plexSeason.parentTitle
              ? titleToSortTitle(plexSeason.parentTitle)
              : '',
            externalId: plexSeason.parentRatingKey,
            identifiers: compact([
              plexSeason.parentRatingKey
                ? {
                    id: plexSeason.parentRatingKey,
                    type: 'plex',
                    sourceId: this.options.mediaSource.uuid,
                  }
                : null,
              plexSeason.parentGuid
                ? {
                    id: plexSeason.parentGuid,
                    type: 'plex-guid',
                  }
                : null,
            ]),
            mediaSourceId: this.options.mediaSource.uuid,
            libraryId: mediaLibrary.uuid,
            plot: null,
            releaseDate: null,
            releaseDateString: null,
            studios: [],
            sourceType: 'plex',
            title: plexSeason.parentTitle ?? '',
            summary: null,
            tagline: null,
            tags: [],
            uuid: v4(),
            type: 'show',
            year: null,
            canonicalId: '???',
            genres: [],
            actors: [],
            rating: null,
            artwork: compact([
              this.plexArtworkInject(plexSeason.parentThumb, 'poster'),
            ]),
          } satisfies PlexShow)
        : undefined,
    } satisfies PlexSeason);
  }

  private plexEpisodeInjection(
    plexEpisode: ApiPlexEpisode,
    mediaLibrary: MediaSourceLibraryOrm,
  ): Result<PlexEpisode> {
    if (isNil(plexEpisode.duration) || plexEpisode.duration <= 0) {
      return Result.forError(
        new Error(
          `Plex episode ID = ${plexEpisode.ratingKey} has invalid duration.`,
        ),
      );
    }

    if (isNil(plexEpisode.Media) || isEmpty(plexEpisode.Media)) {
      return Result.forError(
        new Error(
          `Plex episode ID = ${plexEpisode.ratingKey} has no Media streams`,
        ),
      );
    }

    const episode: PlexEpisode = {
      uuid: v4(),
      canonicalId: this.canonicalizer.getCanonicalId(plexEpisode),
      mediaSourceId: this.options.mediaSource.uuid,
      libraryId: mediaLibrary.uuid,
      type: ProgramType.Episode,
      sourceType: MediaSourceType.Plex,
      title: plexEpisode.title,
      sortTitle: titleToSortTitle(plexEpisode.title),
      originalTitle: null,
      year: null,
      summary: plexEpisode.summary ?? null,
      duration: plexEpisode.duration,
      actors: plexActorInject(plexEpisode.Role),
      directors: plexDirectorInject(plexEpisode.Director),
      writers: plexWriterInject(plexEpisode.Writer),
      episodeNumber: plexEpisode.index ?? 0,
      mediaItem: plexMediaStreamsInject(
        plexEpisode.ratingKey,
        plexEpisode,
      ).getOrElse(() => emptyMediaItem(plexEpisode)),
      genres: [],
      releaseDate: plexEpisode.originallyAvailableAt
        ? +dayjs(plexEpisode.originallyAvailableAt, 'YYYY-MM-DD')
        : null,
      releaseDateString: plexEpisode.originallyAvailableAt ?? null,
      studios: [],
      identifiers: [
        {
          id: plexEpisode.ratingKey,
          type: 'plex',
          sourceId: this.options.mediaSource.uuid,
        },
        {
          id: plexEpisode.guid,
          type: 'plex-guid',
        },
        ...seq.collect(plexEpisode.Guid, (guid) => {
          const parsed = parsePlexGuid(guid.id);
          if (!parsed) return;
          return {
            id: parsed.externalKey,
            type: parsed.sourceType,
          };
        }),
      ],
      tags: [],
      externalId: plexEpisode.ratingKey,
      artwork: compact([
        this.plexArtworkInject(plexEpisode.thumb, 'poster'),
        this.plexArtworkInject(plexEpisode.art, 'banner'),
      ]),
      state: 'ok',
      season: plexEpisode.parentRatingKey
        ? {
            externalId: plexEpisode.parentRatingKey,
            identifiers: compact([
              plexEpisode.parentRatingKey
                ? {
                    id: plexEpisode.parentRatingKey,
                    type: 'plex',
                    sourceId: this.options.mediaSource.uuid,
                  }
                : null,
              plexEpisode.parentGuid
                ? {
                    id: plexEpisode.parentGuid,
                    type: 'plex-guid',
                  }
                : null,
            ]),
            index: plexEpisode.parentIndex ?? 0,
            mediaSourceId: this.options.mediaSource.uuid,
            libraryId: mediaLibrary.uuid,
            plot: null,
            releaseDate: null,
            releaseDateString: null,
            studios: [],
            sourceType: 'plex',
            title: plexEpisode.parentTitle ?? '',
            sortTitle: plexEpisode.parentTitle
              ? titleToSortTitle(plexEpisode.parentTitle)
              : '',
            summary: null,
            tagline: null,
            tags: [],
            uuid: v4(),
            type: 'season',
            year: null,
            canonicalId: '???',
            artwork: compact([
              this.plexArtworkInject(plexEpisode.parentThumb, 'poster'),
            ]),
            show: plexEpisode.grandparentRatingKey
              ? ({
                  externalId: plexEpisode.grandparentRatingKey,
                  identifiers: compact([
                    plexEpisode.grandparentRatingKey
                      ? {
                          id: plexEpisode.grandparentRatingKey,
                          type: 'plex',
                          sourceId: this.options.mediaSource.uuid,
                        }
                      : null,
                    plexEpisode.grandparentGuid
                      ? {
                          id: plexEpisode.grandparentGuid,
                          type: 'plex-guid',
                        }
                      : null,
                  ]),
                  mediaSourceId: this.options.mediaSource.uuid,
                  libraryId: mediaLibrary.uuid,
                  plot: null,
                  releaseDate: null,
                  releaseDateString: null,
                  studios: [],
                  sourceType: 'plex',
                  title: plexEpisode.grandparentTitle ?? '',
                  sortTitle: plexEpisode.grandparentTitle
                    ? titleToSortTitle(plexEpisode.grandparentTitle)
                    : '',
                  summary: null,
                  tagline: null,
                  tags: [],
                  uuid: v4(),
                  type: 'show',
                  year: null,
                  canonicalId: '???',
                  genres: [],
                  actors: [],
                  rating: null,
                  artwork: compact([
                    this.plexArtworkInject(
                      plexEpisode.grandparentThumb,
                      'poster',
                    ),
                    this.plexArtworkInject(
                      plexEpisode.grandparentArt,
                      'banner',
                    ),
                  ]),
                } satisfies PlexShow)
              : undefined,
          }
        : undefined,
    };

    return Result.success(episode);
  }

  private plexMovieInjection(
    plexMovie: ApiPlexMovie,
    mediaLibrary: MediaSourceLibraryOrm,
  ): Result<PlexMovie> {
    if (isNil(plexMovie.duration) || plexMovie.duration <= 0) {
      return Result.forError(
        new Error(
          `Plex movie ID = ${plexMovie.ratingKey} has invalid duration.`,
        ),
      );
    }

    if (isNil(plexMovie.Media) || isEmpty(plexMovie.Media)) {
      return Result.forError(
        new Error(
          `Plex movie ID = ${plexMovie.ratingKey} has no Media streams`,
        ),
      );
    }

    const studios = isNonEmptyString(plexMovie.studio)
      ? [{ name: plexMovie.studio }]
      : [];

    return Result.success({
      uuid: v4(),
      type: ProgramType.Movie,
      canonicalId: this.canonicalizer.getCanonicalId(plexMovie),
      mediaSourceId: this.options.mediaSource.uuid,
      libraryId: mediaLibrary.uuid,
      externalLibraryId: mediaLibrary.externalKey,
      sourceType: MediaSourceType.Plex,
      title: plexMovie.title,
      sortTitle: titleToSortTitle(plexMovie.title),
      originalTitle: null,
      year: plexMovie.year ?? null,
      releaseDate: plexMovie.originallyAvailableAt
        ? +dayjs(plexMovie.originallyAvailableAt, 'YYYY-MM-DD')
        : null,
      releaseDateString: plexMovie.originallyAvailableAt ?? null,
      mediaItem: plexMediaStreamsInject(
        plexMovie.ratingKey,
        plexMovie,
      ).getOrElse(() => emptyMediaItem(plexMovie)),
      duration: plexMovie.duration,
      actors: plexActorInject(plexMovie.Role),
      directors: plexDirectorInject(plexMovie.Director),
      writers: plexWriterInject(plexMovie.Writer),
      studios,
      genres: plexMovie.Genre?.map(({ tag }) => ({ name: tag })) ?? [],
      summary: plexMovie.summary ?? null,
      plot: null,
      tagline: plexMovie.tagline ?? null,
      rating: plexMovie.contentRating ?? null,
      tags: [],
      externalId: plexMovie.ratingKey,
      identifiers: [
        {
          id: plexMovie.ratingKey,
          type: 'plex',
          sourceId: this.options.mediaSource.uuid,
        },
        {
          id: plexMovie.guid,
          type: 'plex-guid',
        },
        ...seq.collect(plexMovie.Guid, (guid) => {
          const parsed = parsePlexGuid(guid.id);
          if (!parsed) return;
          return {
            id: parsed.externalKey,
            type: parsed.sourceType,
          };
        }),
      ],
      artwork: compact([
        this.plexArtworkInject(plexMovie.thumb, 'poster'),
        this.plexArtworkInject(plexMovie.art, 'banner'),
      ]),
      state: 'ok',
    });
  }

  private plexOtherVideoInjection(
    plexClip: ApiPlexMovie,
    mediaLibrary: MediaSourceLibraryOrm,
  ): Result<PlexOtherVideo> {
    if (isNil(plexClip.duration) || plexClip.duration <= 0) {
      return Result.forError(
        new Error(
          `Plex movie ID = ${plexClip.ratingKey} has invalid duration.`,
        ),
      );
    }

    if (isNil(plexClip.Media) || isEmpty(plexClip.Media)) {
      return Result.forError(
        new Error(`Plex movie ID = ${plexClip.ratingKey} has no Media streams`),
      );
    }

    const studios = isNonEmptyString(plexClip.studio)
      ? [{ name: plexClip.studio }]
      : [];

    return Result.success({
      uuid: v4(),
      type: ProgramType.OtherVideo,
      canonicalId: this.canonicalizer.getCanonicalId(plexClip),
      mediaSourceId: this.options.mediaSource.uuid,
      libraryId: mediaLibrary.uuid,
      externalLibraryId: mediaLibrary.externalKey,
      sourceType: MediaSourceType.Plex,
      externalKey: plexClip.ratingKey,
      title: plexClip.title,
      sortTitle: titleToSortTitle(plexClip.title),
      originalTitle: null,
      year: plexClip.year ?? null,
      releaseDate: plexClip.originallyAvailableAt
        ? +dayjs(plexClip.originallyAvailableAt, 'YYYY-MM-DD')
        : null,
      releaseDateString: plexClip.originallyAvailableAt ?? null,
      mediaItem: plexMediaStreamsInject(plexClip.ratingKey, plexClip).getOrElse(
        () => emptyMediaItem(plexClip),
      ),
      duration: plexClip.duration,
      actors: plexActorInject(plexClip.Role),
      directors: plexDirectorInject(plexClip.Director),
      writers: plexWriterInject(plexClip.Writer),
      studios,
      genres: plexClip.Genre?.map(({ tag }) => ({ name: tag })) ?? [],
      summary: plexClip.summary ?? null,
      plot: null,
      tagline: plexClip.tagline ?? null,
      rating: plexClip.contentRating ?? null,
      tags: [],
      externalId: plexClip.ratingKey,
      artwork: compact([
        this.plexArtworkInject(plexClip.thumb, 'poster'),
        this.plexArtworkInject(plexClip.art, 'banner'),
      ]),
      identifiers: [
        {
          id: plexClip.ratingKey,
          type: 'plex',
          sourceId: this.options.mediaSource.uuid,
        },
        {
          id: plexClip.guid,
          type: 'plex-guid',
        },
        ...seq.collect(plexClip.Guid, (guid) => {
          const parsed = parsePlexGuid(guid.id);
          if (!parsed) return;
          return {
            id: parsed.externalKey,
            type: parsed.sourceType,
          };
        }),
      ],
      state: 'ok',
    });
  }

  private plexMusicArtistInjection(
    plexArtist: ApiPlexMusicArtist,
    mediaLibrary: MediaSourceLibraryOrm,
  ): Result<PlexArtist> {
    return Result.success({
      uuid: v4(),
      canonicalId: this.canonicalizer.getCanonicalId(plexArtist),
      mediaSourceId: this.options.mediaSource.uuid,
      libraryId: mediaLibrary.uuid,
      sourceType: MediaSourceType.Plex,
      title: plexArtist.title,
      sortTitle: titleToSortTitle(plexArtist.title),
      type: ProgramGroupingType.Artist,
      tagline: null,
      genres: plexJoinItemInject(plexArtist.Genre),
      summary: plexArtist.summary ?? null,
      plot: null,
      identifiers: [
        {
          type: 'plex',
          id: plexArtist.ratingKey,
          sourceId: this.options.mediaSource.uuid,
        },
        {
          type: 'plex-guid',
          id: plexArtist.guid,
        },
        ...seq.collect(plexArtist.Guid, (guid) => {
          const parsed = parsePlexGuid(guid.id);
          if (!parsed) return;
          return {
            id: parsed.externalKey,
            type: parsed.sourceType,
          };
        }),
      ],
      tags: [],
      externalId: plexArtist.ratingKey,
      artwork: compact([
        this.plexArtworkInject(plexArtist.thumb, 'poster'),
        this.plexArtworkInject(plexArtist.art, 'banner'),
      ]),
    } satisfies PlexArtist);
  }

  private plexAlbumInjection(
    plexAlbum: ApiPlexMusicAlbum,
    mediaLibrary: MediaSourceLibraryOrm,
  ): Result<PlexAlbum> {
    return Result.success({
      uuid: v4(),
      canonicalId: this.canonicalizer.getCanonicalId(plexAlbum),
      mediaSourceId: this.options.mediaSource.uuid,
      libraryId: mediaLibrary.uuid,
      externalLibraryId: mediaLibrary.externalKey,
      sourceType: MediaSourceType.Plex,
      title: plexAlbum.title,
      sortTitle: titleToSortTitle(plexAlbum.title),
      type: ProgramGroupingType.Album,
      index: plexAlbum.index,
      genres: plexJoinItemInject(plexAlbum.Genre),
      plot: plexAlbum.summary ?? null,
      studios: isNonEmptyString(plexAlbum.studio)
        ? [{ name: plexAlbum.studio }]
        : [],
      summary: null,
      tagline: null,
      year: null,
      identifiers: [
        {
          type: 'plex',
          id: plexAlbum.ratingKey,
          sourceId: this.options.mediaSource.uuid,
        },
        {
          type: 'plex-guid',
          id: plexAlbum.guid,
        },
        ...seq.collect(plexAlbum.Guid, (guid) => {
          const parsed = parsePlexGuid(guid.id);
          if (!parsed) return;
          return {
            id: parsed.externalKey,
            type: parsed.sourceType,
          };
        }),
      ],
      tags: [],
      externalId: plexAlbum.ratingKey,
      releaseDate: plexAlbum.originallyAvailableAt
        ? +dayjs(plexAlbum.originallyAvailableAt)
        : null,
      releaseDateString: plexAlbum.originallyAvailableAt ?? null,
      artwork: compact([
        this.plexArtworkInject(plexAlbum.thumb, 'poster'),
        this.plexArtworkInject(plexAlbum.art, 'banner'),
      ]),
    });
  }

  private plexTrackInjection(
    plexTrack: ApiPlexMusicTrack,
    mediaLibrary: MediaSourceLibraryOrm,
  ): Result<PlexTrack, WrappedError> {
    if (isNil(plexTrack.duration) || plexTrack.duration <= 0) {
      return Result.forError(
        new Error(
          `Plex track ID = ${plexTrack.ratingKey} has invalid duration.`,
        ),
      );
    }

    if (isNil(plexTrack.Media) || isEmpty(plexTrack.Media)) {
      return Result.forError(
        new Error(
          `Plex track ID = ${plexTrack.ratingKey} has no Media streams`,
        ),
      );
    }

    return Result.success({
      uuid: v4(),
      canonicalId: this.canonicalizer.getCanonicalId(plexTrack),
      mediaSourceId: this.options.mediaSource.uuid,
      libraryId: mediaLibrary.uuid,
      type: ProgramType.Track,
      sourceType: MediaSourceType.Plex,
      title: plexTrack.title,
      sortTitle: titleToSortTitle(plexTrack.title),
      originalTitle: null,
      year: plexTrack.parentYear ?? null,
      duration: plexTrack.duration ?? 0,
      actors: [],
      directors: [],
      writers: [],
      genres: [],
      trackNumber: plexTrack.index ?? 0,
      mediaItem: plexMediaStreamsInject(
        plexTrack.ratingKey,
        plexTrack,
      ).getOrElse(() => emptyMediaItem(plexTrack)),
      // TODO:
      // genres: plexJoinItemInject(plexTrack.Genre),
      releaseDate: null,
      releaseDateString: null,
      studios: [],
      identifiers: [
        {
          id: plexTrack.ratingKey,
          type: 'plex',
          sourceId: this.options.mediaSource.uuid,
        },
        {
          id: plexTrack.guid,
          type: 'plex-guid',
        },
        ...seq.collect(plexTrack.Guid, (guid) => {
          const parsed = parsePlexGuid(guid.id);
          if (!parsed) return;
          return {
            id: parsed.externalKey,
            type: parsed.sourceType,
          };
        }),
      ],
      tags: [],
      externalId: plexTrack.ratingKey,
      artwork: [],
      state: 'ok',
      album: plexTrack.parentRatingKey
        ? {
            externalId: plexTrack.parentRatingKey,
            identifiers: compact([
              plexTrack.parentRatingKey
                ? {
                    id: plexTrack.parentRatingKey,
                    type: 'plex',
                    sourceId: this.options.mediaSource.uuid,
                  }
                : null,
              plexTrack.parentGuid
                ? {
                    id: plexTrack.parentGuid,
                    type: 'plex-guid',
                  }
                : null,
            ]),
            index: plexTrack.parentIndex ?? 0,
            mediaSourceId: this.options.mediaSource.uuid,
            libraryId: mediaLibrary.uuid,
            plot: null,
            releaseDate: null,
            releaseDateString: null,
            studios: [],
            sourceType: 'plex',
            title: plexTrack.parentTitle ?? '',
            sortTitle: plexTrack.parentTitle
              ? titleToSortTitle(plexTrack.parentTitle)
              : '',
            summary: null,
            tagline: null,
            tags: [],
            uuid: v4(),
            type: 'album',
            year: null,
            canonicalId: '???',
            artwork: compact([
              this.plexArtworkInject(plexTrack.parentThumb, 'poster'),
            ]),
            artist: plexTrack.grandparentRatingKey
              ? ({
                  externalId: plexTrack.grandparentRatingKey,
                  identifiers: compact([
                    plexTrack.grandparentRatingKey
                      ? {
                          id: plexTrack.grandparentRatingKey,
                          type: 'plex',
                          sourceId: this.options.mediaSource.uuid,
                        }
                      : null,
                    plexTrack.grandparentGuid
                      ? {
                          id: plexTrack.grandparentGuid,
                          type: 'plex-guid',
                        }
                      : null,
                  ]),
                  mediaSourceId: this.options.mediaSource.uuid,
                  libraryId: mediaLibrary.uuid,
                  plot: null,
                  sourceType: 'plex',
                  title: plexTrack.grandparentTitle ?? '',
                  sortTitle: plexTrack.grandparentTitle
                    ? titleToSortTitle(plexTrack.grandparentTitle)
                    : '',
                  summary: null,
                  tagline: null,
                  tags: [],
                  uuid: v4(),
                  type: 'artist',
                  canonicalId: '???',
                  genres: [],
                  artwork: [],
                } satisfies PlexArtist)
              : undefined,
          }
        : undefined,
    } satisfies PlexTrack);
  }

  private plexArtworkInject(
    path: Nilable<string>,
    artworkType: ArtworkType,
  ): Maybe<MediaArtwork> {
    if (!isNonEmptyString(path)) {
      return;
    }

    try {
      const url = new URL(path, this.options.mediaSource.uri).href;
      // Explicitly returning empty ID because we cannot know if this artwork is
      // persisted yet or not.
      return {
        type: artworkType,
        path: url,
      };
    } catch {
      return;
    }
  }
}

type PlexTvDevicesResponse = {
  MediaContainer: { Device: PlexResource[] };
};

function plexJoinItemInject(items: Nilable<PlexJoinItem[]>): NamedEntity[] {
  return items?.map(({ tag }) => ({ name: tag })) ?? [];
}

function plexActorInject(items: Nilable<PlexActor[]>): Actor[] {
  return (
    items?.map(
      ({ tag, role, thumb }, idx) =>
        ({ name: tag, role, thumb, order: idx }) satisfies Actor,
    ) ?? []
  );
}

function plexWriterInject(items: Nilable<PlexJoinItem[]>): Writer[] {
  return (
    items?.map(({ tag, thumb }, idx) => ({ name: tag, thumb, order: idx })) ??
    []
  );
}

function plexDirectorInject(items: Nilable<PlexJoinItem[]>): Director[] {
  return (
    items?.map(({ tag, thumb }, idx) => ({ name: tag, thumb, order: idx })) ??
    []
  );
}

function emptyMediaItem(item: PlexTerminalMedia): Maybe<MediaItem> {
  const media = maxBy(
    item.Media?.filter((m) => (m.Part?.length ?? 0) > 0),
    (m) => m.id,
  )!;
  const part = media.Part[0];
  if (!part) {
    return;
  }

  const duration = part?.duration ?? media.duration;

  if (isNil(duration) || duration <= 0) {
    return;
  }

  return {
    displayAspectRatio: '',
    duration,
    sampleAspectRatio: '',
    streams: [],
    resolution: { widthPx: media.width ?? 0, heightPx: media.height ?? 0 },
    locations: [
      {
        externalKey: part.key,
        path: part.file,
        sourceType: MediaSourceType.Plex,
        type: 'remote',
      },
    ],
  };
}

function plexMediaStreamsInject(
  itemId: string,
  plexItem: PlexTerminalMedia,
  requireVideoStream: boolean = true,
): Result<MediaItem> {
  const plexMedia = plexItem.Media;
  if (isNil(plexMedia) || isEmpty(plexMedia)) {
    return Result.forError(
      new Error(`Plex item ID = ${itemId} has no Media streams`),
    );
  }

  const relevantMedia = maxBy(
    filter(
      plexMedia,
      (m) => (m.duration ?? 0) >= 0 && (m.Part?.length ?? 0) > 0,
    ),
    (m) => m.id,
  );

  if (!relevantMedia) {
    return Result.forError(
      new Error(
        `No Media items on Plex item ID = ${itemId} meet the necessary criteria.`,
      ),
    );
  }

  const relevantMediaPart = first(relevantMedia?.Part);
  const apiMediaStreams = relevantMediaPart?.Stream;

  if (!relevantMediaPart || isEmpty(apiMediaStreams)) {
    return Result.forError(
      new Error(`Could not extract a stream for Plex item ID ${itemId}`),
    );
  }

  const videoStream = find(
    apiMediaStreams,
    (stream): stream is PlexMediaVideoStream => stream.streamType === 1,
  );

  if (requireVideoStream && !videoStream) {
    return Result.forError(
      new Error(`Plex item ID = ${itemId} has no video streams`),
    );
  }

  const streams: MediaStream[] = [];
  if (videoStream) {
    const videoDetails = {
      // sampleAspectRatio: isNonEmptyString(videoStream?.pixelAspectRatio)
      //   ? videoStream.pixelAspectRatio
      //   : '1:1',
      // scanType:
      //   videoStream.scanType === 'interlaced'
      //     ? 'interlaced'
      //     : videoStream.scanType === 'progressive'
      //     ? 'progressive'
      //     : 'unknown',
      // width: videoStream.width,
      // height: videoStream.height,
      // frameRate: videoStream.frameRate,
      // displayAspectRatio:
      //   (relevantMedia?.aspectRatio ?? 0) === 0
      //     ? ''
      //     : round(relevantMedia?.aspectRatio ?? 0.0, 10).toFixed(),
      // chapters
      // anamorphic:
      //   videoStream.anamorphic === '1' || videoStream.anamorphic === true,
      streamType: 'video',
      codec: videoStream.codec,
      bitDepth: videoStream.bitDepth ?? 8,
      languageCodeISO6392: videoStream.languageCode,
      default: videoStream.default,
      profile: videoStream.profile?.toLowerCase() ?? '',
      index: videoStream.index,
      frameRate: videoStream.frameRate,
      // streamIndex: videoStream.index?.toString() ?? '0',
    } satisfies MediaStream;
    streams.push(videoDetails);
  }

  streams.push(
    ...map(
      sortBy(
        filter(apiMediaStreams, (stream): stream is PlexMediaAudioStream => {
          return stream.streamType === 2 && !isNil(stream.index);
        }),
        (stream) => [
          stream.selected ? -1 : 0,
          stream.default ? 0 : 1,
          stream.index,
        ],
      ),
      (audioStream) => {
        return {
          streamType: 'audio',
          // bitrate: audioStream.bitrate,
          channels: audioStream.channels,
          codec: audioStream.codec,
          index: audioStream.index,
          // Use the "selected" bit over the "default" if it exists
          // In plex, selected signifies that the user's preferences would choose
          // this stream over others, even if it is not the default
          // This is temporary until we have language preferences within Tunarr
          // to pick these streams.
          profile: audioStream.profile?.toLocaleLowerCase() ?? '',
          selected: audioStream.selected,
          default: audioStream.default,
          languageCodeISO6392: audioStream.languageCode,
          title: audioStream.displayTitle,
        } satisfies MediaStream;
      },
    ),
  );

  const chapters: MediaChapter[] =
    plexItem.type === 'movie' || plexItem.type === 'episode'
      ? (plexItem.Chapter?.map((chapter) => {
          return {
            index: chapter.index,
            endTime: chapter.endTimeOffset,
            startTime: chapter.startTimeOffset,
            chapterType: 'chapter',
            title: chapter.tag,
          } satisfies MediaChapter;
        }) ?? [])
      : [];

  const markers =
    plexItem.type === 'movie' || plexItem.type === 'episode'
      ? (plexItem.Marker ?? [])
      : [];
  const intros = zipWithIndex(
    orderBy(
      markers.filter((marker) => marker.type === 'intro'),
      (marker) => marker.startTimeOffset,
      'asc',
    ),
  ).map(
    ([marker, index]) =>
      ({
        chapterType: 'intro',
        endTime: marker.endTimeOffset,
        startTime: marker.startTimeOffset,
        index,
      }) satisfies MediaChapter,
  );
  const outros = zipWithIndex(
    orderBy(
      markers.filter((marker) => marker.type === 'credits'),
      (marker) => marker.startTimeOffset,
      'asc',
    ),
  ).map(
    ([marker, index]) =>
      ({
        chapterType: 'intro',
        endTime: marker.endTimeOffset,
        startTime: marker.startTimeOffset,
        index,
      }) satisfies MediaChapter,
  );

  chapters.push(...intros, ...outros);

  return Result.success({
    // Handle if this is not present...
    duration: relevantMedia.duration!,
    sampleAspectRatio: isNonEmptyString(videoStream?.pixelAspectRatio)
      ? videoStream.pixelAspectRatio
      : '1:1',
    displayAspectRatio:
      (relevantMedia.aspectRatio ?? 0) === 0
        ? ''
        : (relevantMedia.aspectRatio?.toFixed(2) ?? ''),
    resolution:
      isDefined(relevantMedia.width) && isDefined(relevantMedia.height)
        ? { widthPx: relevantMedia.width, heightPx: relevantMedia.height }
        : undefined,
    frameRate: videoStream?.frameRate?.toFixed(2),
    streams,
    locations: [
      {
        type: 'remote',
        externalKey: relevantMediaPart.key,
        path: relevantMediaPart.file,
        sourceType: MediaSourceType.Plex,
      },
    ],
    chapters,
  } satisfies MediaItem);
}
