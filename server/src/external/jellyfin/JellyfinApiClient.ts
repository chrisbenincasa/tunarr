import { JellyfinRequestRedacter } from '@/external/jellyfin/JellyfinRequestRedacter.js';
import type { Maybe, Nilable, Nullable } from '@/types/util.js';
import {
  attemptSync,
  caughtErrorToError,
  isDefined,
  isNonEmptyString,
  nullToUndefined,
  parseIntOrNull,
} from '@/util/index.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import { getTunarrVersion } from '@/util/version.js';
import { seq } from '@tunarr/shared/util';
import type {
  Actor,
  Director,
  Folder,
  Library,
  MediaArtwork,
  MediaChapter,
  Writer,
} from '@tunarr/types';
import type { MediaSourceStatus, PagedResult } from '@tunarr/types/api';
import type {
  JellyfinItem as ApiJellyfinItem,
  JellyfinItemFields,
  JellyfinItemKind,
  JellyfinItemSortBy,
  JellyfinMediaSourceInfo,
  JellyfinVirtualFolder,
} from '@tunarr/types/jellyfin';
import {
  JellyfinAuthenticationResult,
  JellyfinLibraryItemsResponse,
  JellyfinSystemInfo,
  JellyfinVirtualFolderResponse,
} from '@tunarr/types/jellyfin';
import type { AxiosRequestConfig } from 'axios';
import axios, { isAxiosError } from 'axios';
import dayjs from 'dayjs';
import {
  compact,
  every,
  find,
  floor,
  forEach,
  groupBy,
  isBoolean,
  isEmpty,
  isError,
  isNil,
  isNull,
  isNumber,
  mapValues,
  omitBy,
  orderBy,
  trimStart,
  union,
} from 'lodash-es';
import type { NonEmptyArray } from 'ts-essentials';
import { match, P } from 'ts-pattern';
import { v4 } from 'uuid';
import type { ArtworkType } from '../../db/schema/Artwork.ts';
import type { ProgramType } from '../../db/schema/Program.ts';
import type { ProgramGroupingType } from '../../db/schema/ProgramGrouping.ts';
import type { Canonicalizer } from '../../services/Canonicalizer.ts';
import { extractIsAnamorphic } from '../../stream/jellyfin/JellyfinStreamDetails.ts';
import type {
  JellyfinEpisode as ApiJellyfinEpisode,
  JellyfinMovie as ApiJellyfinMovie,
  JellyfinMusicAlbum as ApiJellyfinMusicAlbum,
  JellyfinMusicArtist as ApiJellyfinMusicArtist,
  JellyfinMusicTrack as ApiJellyfinMusicTrack,
  JellyfinMusicVideo as ApiJellyfinMusicVideo,
  JellyfinOtherVideo as ApiJellyfinOtherVideo,
  JellyfinSeason as ApiJellyfinSeason,
  JellyfinSeries as ApiJellyfinSeries,
  SpecificJellyfinType,
} from '../../types/JellyfinTypes.ts';
import { isJellyfinType } from '../../types/JellyfinTypes.ts';
import type {
  Identifier,
  JellyfinEpisode,
  JellyfinItem,
  JellyfinMovie,
  JellyfinMusicAlbum,
  JellyfinMusicArtist,
  JellyfinMusicTrack,
  JellyfinMusicVideo,
  JellyfinOtherVideo,
  JellyfinSeason,
  JellyfinShow,
  MediaItem,
  MediaStream,
} from '../../types/Media.ts';
import { Result } from '../../types/result.ts';
import { titleToSortTitle } from '../../util/programs.ts';
import {
  QueryError,
  type ApiClientOptions,
  type QueryResult,
} from '../BaseApiClient.js';
import { MediaSourceApiClient } from '../MediaSourceApiClient.ts';

const RequiredLibraryFields = [
  'Path',
  'Genres',
  'Tags',
  'DateCreated',
  'Etag',
  'Overview',
  'Taglines',
  'Studios',
  'People',
  'ProviderIds',
  'Chapters',
  'PremiereDate',
  'OfficialRating',
  'MediaStreams',
  'MediaSources',
];

function getJellyfinAuthorization(
  apiKey: Maybe<string>,
  clientId: Maybe<string>,
) {
  const parts: string[] = [];
  if (isNonEmptyString(apiKey)) {
    parts.push(`Token="${apiKey}"`);
  }
  if (isNonEmptyString(clientId)) {
    parts.push(`DeviceId="${clientId}"`);
  }
  parts.push(
    'Client="Tunarr", Device="Web Browser"',
    `Version="${getTunarrVersion()}"`,
  );

  return `MediaBrowser ${parts.join(', ')}`;
}

export type JellyfinApiClientOptions = Omit<ApiClientOptions, 'type'>;

export type JellyfinGetItemsQuery = {
  recursive?: boolean;
  searchTerm?: string;
  nameStartsWith?: string;
  nameStartsWithOrGreater?: string;
  nameLessThan?: string;
  genres?: string[];
  ids?: string[];
  hasImdbId?: boolean;
  hasTmdbId?: boolean;
  hasTvdbId?: boolean;
  contributingArtistIds?: string[];
  excludeItemIds?: string[];
  albumArtistIds?: string[];
};

type JellyfinItemTypes = {
  [ProgramType.Movie]: JellyfinMovie;
  [ProgramGroupingType.Show]: JellyfinShow;
  [ProgramGroupingType.Season]: JellyfinSeason;
  [ProgramType.Episode]: JellyfinEpisode;
  [ProgramGroupingType.Artist]: JellyfinMusicArtist;
  [ProgramGroupingType.Album]: JellyfinMusicAlbum;
  [ProgramType.Track]: JellyfinMusicTrack;
};

export class JellyfinApiClient extends MediaSourceApiClient<JellyfinItemTypes> {
  protected redacter = new JellyfinRequestRedacter();

  constructor(
    private canonicalizer: Canonicalizer<ApiJellyfinItem>,
    options: ApiClientOptions,
  ) {
    super({
      ...options,
      extraHeaders: {
        ...options.extraHeaders,
        Accept: 'application/json',
        Authorization: getJellyfinAuthorization(
          options.mediaSource.accessToken,
          undefined,
        ),
      },
    });
  }

  static async login(
    serverUrl: string,
    username: string,
    password: string,
    clientId: string = v4(),
  ) {
    try {
      const response = await axios.post(
        `${serverUrl}/Users/AuthenticateByName`,
        {
          Username: username,
          Pw: password,
        },
        {
          headers: {
            Authorization: getJellyfinAuthorization(undefined, clientId),
          },
        },
      );

      return await JellyfinAuthenticationResult.parseAsync(response.data);
    } catch (e) {
      if (isAxiosError(e) && e.config) {
        new JellyfinRequestRedacter().redact(e.config);
      }

      LoggerFactory.root.error(
        { error: e as unknown, className: JellyfinApiClient.name },
        'Error logging into Jellyfin',
      );
      throw e;
    }
  }

  async ping(): Promise<MediaSourceStatus> {
    try {
      await this.doGet({
        url: '/System/Ping',
      });

      // One of these should succeed. In the username/pw case
      // we should be able to at least retrieve our own user.
      // Access token based auth will not have a "me" but should be able
      // to at least list all users.
      const [meResult, allUsersResult] = await Promise.allSettled([
        this.doGet({
          url: '/Users/Me',
          params: {
            userId: this.options.mediaSource.userId,
          },
        }),
        this.doGet({
          url: '/Users',
        }),
      ]);

      if (
        meResult.status === 'fulfilled' ||
        allUsersResult.status === 'fulfilled'
      ) {
        return { healthy: true };
      } else {
        return {
          healthy: false,
          status: 'auth',
        };
      }
    } catch (e) {
      return {
        healthy: false,
        status: this.getHealthStatus(e),
      };
    }
  }

  async getSystemInfo() {
    return this.doTypeCheckedGet('/System/Info', JellyfinSystemInfo);
  }

  async getUserLibraries(): Promise<QueryResult<Library[]>> {
    const result = await this.doTypeCheckedGet(
      '/Library/VirtualFolders',
      JellyfinVirtualFolderResponse,
    );
    return result.mapPure((data) =>
      data.map((lib) => this.virtualFolderToLibrary(lib)),
    );
  }

  async getUserViewsRaw() {
    return this.doTypeCheckedGet(
      '/Library/VirtualFolders',
      JellyfinVirtualFolderResponse,
      {
        params: {
          includeExternalContent: false,
          presetViews: [
            'movies',
            'tvshows',
            'music',
            'playlists',
            'folders',
            'homevideos',
            'boxsets',
            'trailers',
            'musicvideos',
          ],
        },
      },
    );
  }

  async getUserViews() {
    const result = await this.getUserViewsRaw();

    return result.mapPure((data) =>
      data.map((lib) => this.virtualFolderToLibrary(lib)),
    );
  }

  private virtualFolderToLibrary(lib: JellyfinVirtualFolder): Library {
    return {
      type: 'library',
      externalId: lib.ItemId,
      locations: lib.LibraryOptions.PathInfos.map((path) => ({
        type: 'local',
        path: path.Path,
      })),
      sourceType: 'jellyfin',
      title: lib.Name,
      uuid: v4(),
      childType: match(lib.CollectionType)
        .returnType<Folder['childType']>()
        .with('movies', () => 'movie')
        .with('musicvideos', () => 'music_video')
        .with('tvshows', () => 'show')
        .with('music', () => 'artist')
        .with('homevideos', () => 'other_video')
        .otherwise(() => undefined),
    } satisfies Library;
  }

  async getMovie(itemId: string, extraFields: JellyfinItemFields[] = []) {
    return this.getItemOfType(
      itemId,
      'Movie',
      (movie) => this.jellyfinApiMovieInjection(movie),
      extraFields,
    );
  }

  async getEpisode(itemId: string, extraFields: JellyfinItemFields[] = []) {
    return this.getItemOfType(
      itemId,
      'Episode',
      (ep) => this.jellyfinApiEpisodeInjection(ep),
      extraFields,
    );
  }

  async getMusicArtist(
    artistKey: string,
  ): Promise<QueryResult<JellyfinMusicArtist>> {
    return this.getItemOfType(artistKey, 'MusicArtist', (artist) =>
      this.jellyfinApiMusicArtistInjection(artist),
    );
  }

  async getMusicAlbum(
    albumKey: string,
  ): Promise<QueryResult<JellyfinMusicAlbum>> {
    return this.getItemOfType(albumKey, 'MusicAlbum', (album) =>
      this.jellyfinApiMusicAlbumInjection(album),
    );
  }

  async getMusicTrack(
    itemId: string,
  ): Promise<QueryResult<JellyfinMusicTrack>> {
    return this.getItemOfType(itemId, 'Audio', (track) =>
      this.jellyfinApiMusicTrackInjection(track),
    );
  }

  private async getItemOfType<ItemTypeT extends JellyfinItemKind, OutType>(
    itemId: string,
    itemType: ItemTypeT,
    converter: (item: SpecificJellyfinType<ItemTypeT>) => Nullable<OutType>,
    extraFields: JellyfinItemFields[] = [],
  ): Promise<QueryResult<OutType>> {
    return this.getRawItem(itemId, itemType, extraFields).then((result) => {
      return result.flatMap((item) => {
        if (!item) {
          return this.makeErrorResult(
            'not_found',
            `Could not find Jellyfin item with ID = ${itemId} of type ${itemType}`,
          );
        }

        if (!isJellyfinType(item, itemType)) {
          return this.makeErrorResult(
            'generic_request_error',
            `Expected item of type ${itemType} for Jellyfin item ${itemId}, but got ${item.Type}`,
          );
        }

        return Result.attempt(() => converter(item)).ifNil(
          QueryError.create(
            'generic_request_error',
            `Could not convert Jellyfin item with id = ${itemId}`,
          ),
        );
      });
    });
  }

  async getItems(
    parentId: Nilable<string>,
    itemTypes: Nilable<JellyfinItemKind[]> = null,
    extraFields: JellyfinItemFields[] = [],
    pageParams: Nilable<{ offset: number; limit: number }> = null,
    extraParams: JellyfinGetItemsQuery = {},
    sortBy: [JellyfinItemSortBy, ...JellyfinItemSortBy[]] = [
      'SortName',
      'ProductionYear',
    ],
  ): Promise<QueryResult<PagedResult<JellyfinItem[]>>> {
    const result = await this.getRawItems(
      parentId,
      itemTypes,
      extraFields,
      pageParams,
      extraParams,
      sortBy,
    );

    return result.mapPure((data) => {
      const out = seq.collect(data.Items, (item) =>
        this.jelllyfinApiItemInjection(item),
      );

      return {
        total: data.TotalRecordCount,
        result: out,
        size: out.length,
        offset: data.StartIndex ?? undefined,
      };
    });
  }

  async getItem<ItemTypeT extends JellyfinItemKind>(
    itemId: string,
    itemType: ItemTypeT | null = null,
    extraFields: JellyfinItemFields[] = [],
  ): Promise<QueryResult<Maybe<JellyfinItem>>> {
    const item = await this.getRawItem(itemId, itemType, extraFields);
    return item.mapPure((data) => {
      if (!data) {
        return;
      }

      return this.jelllyfinApiItemInjection(data) ?? undefined;
    });
  }

  async getRawItem<ItemTypeT extends JellyfinItemKind>(
    itemId: string,
    itemType: ItemTypeT | null = null,
    extraFields: JellyfinItemFields[] = [],
  ): Promise<QueryResult<Maybe<ApiJellyfinItem>>> {
    const result = await this.getRawItems(
      null,
      itemType ? [itemType] : null,
      ['MediaStreams', 'MediaSources', ...extraFields],
      { offset: 0, limit: 1 },
      {
        ids: [itemId],
      },
    );

    return result.mapPure((data) => {
      return find(data.Items, (item) => item.Id === itemId);
    });
  }

  async getRawItems(
    parentId: Nilable<string>,
    itemTypes: Nilable<JellyfinItemKind[]> = null,
    extraFields: JellyfinItemFields[] = [],
    pageParams: Nilable<{ offset: number; limit: number }> = null,
    extraParams: JellyfinGetItemsQuery = {},
    sortBy: [JellyfinItemSortBy, ...JellyfinItemSortBy[]] = [
      'SortName',
      'ProductionYear',
    ],
  ): Promise<QueryResult<JellyfinLibraryItemsResponse>> {
    return this.doTypeCheckedGet('/Items', JellyfinLibraryItemsResponse, {
      params: omitBy(
        {
          userId: this.options.mediaSource.userId,
          parentId: parentId,
          fields: union(extraFields, RequiredLibraryFields).join(','),
          startIndex: pageParams?.offset,
          limit: pageParams?.limit,
          // These will be configurable eventually
          sortOrder: 'Ascending',
          sortBy: sortBy.join(','),
          recursive: extraParams.recursive?.toString() ?? 'true',
          includeItemTypes: itemTypes ? itemTypes.join(',') : undefined,
          ...{
            ...mapValues(extraParams, (v) => (isBoolean(v) ? v.toString() : v)),
            ids: extraParams.ids?.join(','),
            genres: extraParams.genres?.join('|'),
          },
          contributingArtistIds: extraParams.contributingArtistIds?.join(','),
          excludeItemIds: extraParams.excludeItemIds?.join(','),
          albumArtistIds: extraParams.albumArtistIds?.join(','),
        },
        (v) => isNil(v) || (!isNumber(v) && isEmpty(v)),
      ),
    });
  }

  async getAlbumArtists(
    userId: Nilable<string>,
    parentId: Nilable<string>,
    extraFields: JellyfinItemFields[] = [],
    pageParams: Nilable<{ offset: number; limit: number }> = null,
    extraParams: JellyfinGetItemsQuery = {},
    sortBy: NonEmptyArray<JellyfinItemSortBy> = ['SortName'],
  ): Promise<QueryResult<JellyfinLibraryItemsResponse>> {
    return this.doTypeCheckedGet(
      '/Artists/AlbumArtists',
      JellyfinLibraryItemsResponse,
      {
        params: omitBy(
          {
            userId: userId ?? this.options.mediaSource.userId,
            parentId: parentId,
            fields: union(extraFields, RequiredLibraryFields).join(','),
            startIndex: pageParams?.offset,
            limit: pageParams?.limit,
            // These will be configurable eventually
            sortOrder: 'Ascending',
            sortBy: sortBy.join(','),
            recursive: extraParams.recursive?.toString() ?? 'true',
            // includeItemTypes: itemTypes ? itemTypes.join(',') : undefined,
            ...{
              ...mapValues(extraParams, (v) =>
                isBoolean(v) ? v.toString() : v,
              ),
              ids: extraParams.ids?.join(','),
              genres: extraParams.genres?.join('|'),
            },
          },
          (v) => isNil(v) || (!isNumber(v) && isEmpty(v)),
        ),
      },
    );
  }

  async getSubtitles(
    itemId: string,
    mediaItemId: string,
    streamIndex: number,
    subtitleExt: string,
    tickOffset: number = 0,
  ): Promise<QueryResult<string>> {
    try {
      const subtitlesResult = await this.doGet<string>({
        url: `/Videos/${itemId}/${mediaItemId}/Subtitles/${streamIndex}/${tickOffset}/Stream.${trimStart(subtitleExt, '.')}`,
        params: {
          userId: this.options.mediaSource.userId,
        },
      });

      return this.makeSuccessResult(subtitlesResult);
    } catch (e) {
      const err = caughtErrorToError(e);
      return this.makeErrorResult('generic_request_error', err.message);
    }
  }

  getMovieLibraryContents(
    parentId: string,
    pageSize: number = 50,
  ): AsyncIterable<JellyfinMovie> {
    return this.getChildContents(
      parentId,
      'Movie',
      (movie) => this.jellyfinApiMovieInjection(movie),
      [],
      {},
      pageSize,
    );
  }

  getOtherVideoLibraryContents(
    parentId: string,
    pageSize: number = 50,
  ): AsyncIterable<JellyfinOtherVideo> {
    return this.getChildContents(
      parentId,
      'Video',
      (video) => this.jellyfinApiOtherVideoInjection(video),
      [],
      {},
      pageSize,
    );
  }

  getTvShowLibraryContents(
    parentId: string,
    pageSize: number = 50,
  ): AsyncIterable<JellyfinShow> {
    return this.getChildContents(
      parentId,
      'Series',
      (show) => this.jellyfinApiShowInjection(show),
      ['Overview'],
      {},
      pageSize,
    );
  }

  getShowSeasons(
    parentId: string,
    pageSize: number = 50,
  ): AsyncIterable<JellyfinSeason> {
    return this.getChildContents(
      parentId,
      'Season',
      (season) => this.jellyfinApiSeasonInjection(season),
      ['Overview'],
      {},
      pageSize,
    );
  }

  async getShow(externalKey: string): Promise<QueryResult<JellyfinShow>> {
    return this.getItemOfType(externalKey, 'Series', (series) =>
      this.jellyfinApiShowInjection(series),
    );
  }

  async getSeason(externalKey: string): Promise<QueryResult<JellyfinSeason>> {
    return this.getItemOfType(externalKey, 'Season', (season) =>
      this.jellyfinApiSeasonInjection(season),
    );
  }

  getSeasonEpisodes(
    _: string,
    seasonId: string,
    pageSize: number = 50,
  ): AsyncIterable<JellyfinEpisode> {
    return this.getChildContents(
      seasonId,
      'Episode',
      (ep) => this.jellyfinApiEpisodeInjection(ep),
      [],
      {},
      pageSize,
    );
  }

  getMusicLibraryContents(
    libraryId: string,
    pageSize: number,
  ): AsyncIterable<JellyfinMusicArtist> {
    return this.getChildContents(
      libraryId,
      'MusicArtist',
      (artist) => this.jellyfinApiMusicArtistInjection(artist),
      [],
      {},
      pageSize,
      (page) =>
        this.getAlbumArtists(
          null,
          libraryId,
          [],
          {
            offset: page * pageSize,
            limit: pageSize,
          },
          {},
        ),
    );
  }

  getArtistAlbums(
    artistKey: string,
    pageSize: number,
  ): AsyncIterable<JellyfinMusicAlbum> {
    return this.getChildContents(
      artistKey,
      'MusicAlbum',
      (album) => this.jellyfinApiMusicAlbumInjection(album),
      [],
      {
        recursive: true,
      },
      pageSize,
      (page) =>
        this.getRawItems(
          null,
          ['MusicAlbum'],
          [],
          {
            offset: page * pageSize,
            limit: pageSize,
          },
          {
            albumArtistIds: [artistKey],
          },
        ),
    );
  }

  getAlbumTracks(
    albumKey: string,
    pageSize: number,
  ): AsyncIterable<JellyfinMusicTrack> {
    return this.getChildContents(
      albumKey,
      'Audio',
      (track) => this.jellyfinApiMusicTrackInjection(track),
      [],
      {
        recursive: true,
      },
      pageSize,
    );
  }

  private async *getChildContents<ItemTypeT extends JellyfinItemKind, OutType>(
    parentId: string,
    itemType: ItemTypeT,
    converter: (item: SpecificJellyfinType<ItemTypeT>) => Nullable<OutType>,
    extraFields: JellyfinItemFields[] = [],
    extraParams: JellyfinGetItemsQuery = {},
    pageSize: number = 50,
    getter: (
      page: number,
    ) => Promise<QueryResult<JellyfinLibraryItemsResponse>> = (page) =>
      this.getRawItems(
        parentId,
        [itemType],
        extraFields,
        {
          offset: page * pageSize,
          limit: pageSize,
        },
        extraParams,
      ),
  ): AsyncIterable<OutType> {
    const count = await this.getChildItemCount(parentId, itemType);
    if (count.isFailure()) {
      return count;
    }

    const totalPages = Math.ceil(count.get() / pageSize);

    for (let page = 0; page <= totalPages; page++) {
      const chunkResult = await getter(page);

      if (chunkResult.isFailure()) {
        throw chunkResult.error;
      }

      for (const item of chunkResult.get().Items ?? []) {
        if (isJellyfinType(item, itemType)) {
          const convertedResult = Result.attempt(() => converter(item));
          if (convertedResult.isFailure()) {
            this.logger.error(
              convertedResult.error,
              'Failure converting Jellyfin item %s',
              item.Id,
            );
            continue;
          }
          const converted = convertedResult.get();
          if (converted) {
            yield converted;
          }
        }
      }
    }

    return;
  }

  async getChildItemCount(parentId: string, itemType: JellyfinItemKind) {
    const endpoint =
      itemType === 'MusicArtist' ? '/Artists/AlbumArtists' : '/Items';
    return this.doTypeCheckedGet(endpoint, JellyfinLibraryItemsResponse, {
      params: {
        userId: this.options.mediaSource.userId,
        parentId,
        startIndex: 0,
        limit: 0,
        recursive: true,
        includeItemTypes: itemType,
      },
    }).then((_) => _.map((response) => response.TotalRecordCount));
  }

  getThumbUrl(
    id: string,
    imageType:
      | 'Primary'
      | 'Art'
      | 'Thumb'
      | 'Banner'
      | 'Screenshot' = 'Primary',
  ) {
    // Naive impl for now...
    return `${this.options.mediaSource.uri}/Items/${id}/Images/${imageType}`;
  }

  getExternalUrl(id: string) {
    return `${this.options.mediaSource.uri}/web/#/details?id=${id}`;
  }

  async getGenres(
    parentId?: string,
    includeItemTypes?: string,
  ): Promise<QueryResult<JellyfinLibraryItemsResponse>> {
    try {
      return this.doTypeCheckedGet('/Genres', JellyfinLibraryItemsResponse, {
        params: {
          parentId,
          userId: this.options.mediaSource.userId,
          includeItemTypes,
          recursive: true,
        },
      });
    } catch (e) {
      const err = caughtErrorToError(e);
      return this.makeErrorResult('generic_request_error', err.message);
    }
  }

  async recordPlaybackStart(itemId: string, deviceId: string) {
    return this.doPost({
      url: '/Sessions/Playing',
      params: {
        userId: this.options.mediaSource.userId,
      },
      headers: {
        Authorization: getJellyfinAuthorization(
          this.options.mediaSource.accessToken,
          deviceId,
        ),
      },
      data: {
        ItemId: itemId,
        PlayMethod: 'DirectStream',
        PositionTicks: 0,
        CanSeek: false,
      },
    });
  }

  async updateUserItemPlayback(itemId: string, elapsedMs: number) {
    return this.doPost({
      url: `/UserItems/${itemId}/UserData`,
      params: {
        userId: this.options.mediaSource.userId,
      },
      data: {
        PlaybackPositionTicks: elapsedMs * 10000,
      },
    });
  }

  async recordPlaybackProgress(
    itemId: string,
    elapsedMs: number,
    deviceId: string,
    isStopped: boolean = false,
  ) {
    return this.doPost({
      url: `/Sessions/Playing/${isStopped ? 'Stopped' : 'Progress'}`,
      params: {
        userId: this.options.mediaSource.userId,
      },
      headers: {
        Authorization: getJellyfinAuthorization(
          this.options.mediaSource.accessToken,
          deviceId,
        ),
      },
      data: {
        ItemId: itemId,
        PlayMethod: 'DirectStream',
        PositionTicks: elapsedMs * 10000,
        CanSeek: false,
      },
    });
  }

  static getThumbUrl(opts: {
    uri: string;
    accessToken: string;
    itemKey: string;
    width?: number;
    height?: number;
    upscale?: string;
  }): string {
    return `${opts.uri}/Items/${opts.itemKey}/Images/Primary`;
  }

  protected override preRequestValidate<T>(
    req: AxiosRequestConfig,
  ): Maybe<QueryResult<T>> {
    if (isEmpty(this.options.mediaSource.accessToken)) {
      return this.makeErrorResult(
        'no_access_token',
        'No Jellyfin token provided.',
      );
    }
    return super.preRequestValidate(req);
  }

  private jelllyfinApiItemInjection(item: ApiJellyfinItem) {
    return match(item)
      .returnType<JellyfinItem | Folder | null>()
      .with({ Type: 'Movie' }, (m) => this.jellyfinApiMovieInjection(m))
      .with({ Type: 'Series' }, (m) => this.jellyfinApiShowInjection(m))
      .with({ Type: 'Season' }, (m) => this.jellyfinApiSeasonInjection(m))
      .with({ Type: 'Episode' }, (m) => this.jellyfinApiEpisodeInjection(m))
      .with({ Type: 'MusicArtist' }, (a) =>
        this.jellyfinApiMusicArtistInjection(a),
      )
      .with({ Type: 'MusicAlbum' }, (a) =>
        this.jellyfinApiMusicAlbumInjection(a),
      )
      .with({ Type: 'Audio' }, (a) => this.jellyfinApiMusicTrackInjection(a))
      .with({ Type: 'MusicVideo' }, (mv) =>
        this.jellyfinApiMusicVideoInjection(mv),
      )
      .with({ Type: 'Video' }, (v) => this.jellyfinApiOtherVideoInjection(v))
      .with(
        {
          Type: P.union(
            'Folder',
            'CollectionFolder',
            'AggregateFolder',
            'UserRootFolder',
          ),
        },
        (f) => ({
          type: 'folder',
          externalId: f.Id,
          title: f.Name ?? '',
          uuid: v4(),
          childCount: f.ChildCount ?? undefined,
          mediaSourceId: this.options.mediaSource.uuid,
          libraryId: '',
          sourceType: 'jellyfin',
          childType: match(f.CollectionType)
            .returnType<Folder['childType']>()
            .with('movies', () => 'movie')
            .with('musicvideos', () => 'music_video')
            .with('tvshows', () => 'show')
            .with('music', () => 'artist')
            .otherwise(() => undefined),
        }),
      )
      .otherwise(() => null);
  }

  private jellyfinApiMovieInjection(
    movie: ApiJellyfinMovie,
  ): Nullable<JellyfinMovie> {
    if (isEmpty(movie.Name)) {
      this.logger.warn(
        'Jellyfin movie ID = %s missing title. Skipping',
        movie.Id,
      );
      return null;
    }

    const people = getJellyfinItemPersonMap(
      movie,
      this.options.mediaSource.uri,
    );
    const parsedReleaseDate = isNonEmptyString(movie.PremiereDate)
      ? attemptSync(() => dayjs(movie.PremiereDate))
      : null;
    const mediaItem = this.jellyfinApiMediaSourcesInjection(
      movie,
      movie.MediaSources ?? [],
    );

    if (!movie.RunTimeTicks || movie.RunTimeTicks <= 0) {
      return null;
    }

    if (!mediaItem) {
      return null;
    }

    return {
      uuid: v4(),
      canonicalId: this.canonicalizer.getCanonicalId(movie),
      title: movie.Name!,
      sortTitle: titleToSortTitle(movie.Name!),
      originalTitle: movie.OriginalTitle ?? null,
      year: movie.ProductionYear ?? null,
      releaseDate: isError(parsedReleaseDate)
        ? null
        : (parsedReleaseDate?.valueOf() ?? null),
      releaseDateString: movie.PremiereDate ?? null,
      actors: people['actor'] ?? [],
      writers: people['writer'] ?? [],
      directors: people['director'] ?? [],
      genres:
        movie.Genres?.map((genre) => ({
          name: genre,
        })) ?? [],
      studios: seq.collect(movie.Studios, (studio) => {
        if (isNonEmptyString(studio.Name)) {
          return { name: studio.Name };
        }
        return;
      }),
      plot: movie.Overview ?? null,
      rating: movie.OfficialRating ?? null,
      sourceType: 'jellyfin',
      tagline: find(movie.Taglines, isNonEmptyString) ?? null,
      tags: movie.Tags?.filter(isNonEmptyString) ?? [],
      summary: null,
      type: 'movie',
      mediaItem,
      identifiers: collectJellyfinItemIdentifiers(
        movie,
        this.options.mediaSource.uuid,
      ),
      mediaSourceId: this.options.mediaSource.uuid,
      libraryId: '', // We can't know this at this point...
      duration: movie.RunTimeTicks / 10_000,
      externalId: movie.Id,
      artwork: compact([
        this.jellyfinArtworkProjection('poster', movie, 'Primary'),
        this.jellyfinArtworkProjection('banner', movie, 'Banner'),
        this.jellyfinArtworkProjection('thumbnail', movie, 'Thumb'),
      ]),
      state: 'ok',
    };
  }

  private jellyfinApiMediaSourcesInjection(
    item: ApiJellyfinItem,
    sources: JellyfinMediaSourceInfo[],
  ): Maybe<MediaItem> {
    if (sources.length === 0) {
      this.logger.warn('Empty media sources!');
      return;
    }

    const source = find(sources, { Protocol: 'File' }) ?? sources[0]!;

    if (isEmpty(source.MediaStreams)) {
      this.logger.warn('No media streams!');
      return;
    }

    let streamIndexOffset = 0;
    const ordered = orderBy(
      source.MediaStreams,
      (stream) => stream.Index,
      'asc',
    );
    for (const stream of ordered) {
      if (stream.IsExternal) {
        streamIndexOffset++;
      } else {
        break;
      }
    }

    const videoStream = find(source.MediaStreams, { Type: 'Video' });
    if (!videoStream) {
      return;
    }

    const width = videoStream.Width ?? 1;
    const height = videoStream.Height ?? 1;
    const isAnamorphic =
      videoStream.IsAnamorphic ??
      (isNonEmptyString(videoStream.AspectRatio) &&
      videoStream.AspectRatio.includes(':')
        ? extractIsAnamorphic(width, height, videoStream.AspectRatio)
        : false);

    const videoMediaStream: MediaStream = {
      streamType: 'video',
      index: Math.max(0, (videoStream.Index ?? 0) - streamIndexOffset),
      codec: videoStream.Codec ?? 'unknown',
      profile: (videoStream.Profile ?? '')?.toLowerCase(),
      bitDepth: nullToUndefined(videoStream.BitDepth),
      default: videoStream.IsDefault,
      fileName: nullToUndefined(videoStream.Path),
      pixelFormat: nullToUndefined(videoStream.PixelFormat),
      selected: videoStream.IsForced,
    };

    const audioMediaStreams: MediaStream[] =
      source.MediaStreams?.filter((stream) => stream.Type === 'Audio').map(
        (audioStream) => {
          return {
            streamType: 'audio',
            codec: audioStream.Codec ?? 'unknown',
            profile: (audioStream.Profile ?? '').toLowerCase(),
            channels: audioStream.Channels ?? 2,
            selected: audioStream.IsForced,
            languageCodeISO6392: nullToUndefined(audioStream.Language),
            index: Math.max(0, (audioStream.Index ?? 0) - streamIndexOffset),
          };
        },
      ) ?? [];

    const subtitleStreams: MediaStream[] =
      source.MediaStreams?.filter((stream) => stream.Type === 'Subtitle').map(
        (subStream) => {
          return {
            streamType: subStream.IsExternal
              ? 'external_subtitles'
              : 'subtitles',
            codec: (subStream.Codec ?? '').toLowerCase(),
            profile: (subStream.Profile ?? '')?.toLowerCase(),
            default: subStream.IsDefault,
            selected: subStream.IsForced,
            languageCodeISO6392: nullToUndefined(subStream.Language),
            index: Math.max(0, (subStream.Index ?? 0) - streamIndexOffset),
          };
        },
      ) ?? [];

    const chapters: MediaChapter[] = [];
    const apiChapters = item.Chapters ?? [];
    // We can't get end times unless they all have starts...
    if (
      (item.RunTimeTicks ?? 0) > 0 &&
      every(apiChapters, (c) => isDefined(c.StartPositionTicks))
    ) {
      for (let i = 0; i < apiChapters.length; i++) {
        const chapter = apiChapters[i]!;
        const isLast = i === apiChapters.length - 1;
        const end = floor(
          isLast
            ? item.RunTimeTicks! / 10_000
            : apiChapters[i + 1]!.StartPositionTicks! / 10_000,
        );
        chapters.push({
          chapterType: 'chapter',
          endTime: end,
          index: i,
          startTime: chapter.StartPositionTicks!,
          title: chapter.Name,
        });
      }
    }

    return {
      displayAspectRatio: videoStream.AspectRatio ?? '',
      sampleAspectRatio: isAnamorphic ? '0:0' : '1:1',
      duration: +dayjs.duration(Math.ceil((source.RunTimeTicks ?? 0) / 10_000)),
      frameRate: videoStream.RealFrameRate?.toFixed(2),
      locations: [
        {
          type: 'remote',
          sourceType: 'jellyfin',
          externalKey: item.Id,
          path: source.Path ?? '',
        },
      ],
      streams: [videoMediaStream, ...audioMediaStreams, ...subtitleStreams],
      resolution: {
        widthPx: width,
        heightPx: height,
      },
      chapters,
    };
  }

  private jellyfinApiShowInjection(
    series: ApiJellyfinSeries,
  ): Nullable<JellyfinShow> {
    if (isEmpty(series.Name)) {
      this.logger.warn(
        'Jellyfin movie ID = %s missing title. Skipping',
        series.Id,
      );
      return null;
    }

    const people = getJellyfinItemPersonMap(
      series,
      this.options.mediaSource.uri,
    );

    const parsedReleaseDate = isNonEmptyString(series.PremiereDate)
      ? attemptSync(() => dayjs(series.PremiereDate))
      : null;

    return {
      uuid: v4(),
      externalId: series.Id,
      canonicalId: this.canonicalizer.getCanonicalId(series),
      title: series.Name!,
      sortTitle: titleToSortTitle(series.Name!),
      // originalTitle: series.OriginalTitle ?? null,
      year: series.ProductionYear ?? null,
      releaseDate: isError(parsedReleaseDate)
        ? null
        : (parsedReleaseDate?.valueOf() ?? null),
      releaseDateString: series.PremiereDate ?? null,
      mediaSourceId: this.options.mediaSource.uuid,
      libraryId: '', // We can't know this at this point...
      actors: people['actor'] ?? [],
      // Consider adding this
      // writers: people['writer'] ?? [],
      genres:
        series.Genres?.map((genre) => ({
          name: genre,
        })) ?? [],
      studios: seq.collect(series.Studios, (studio) => {
        if (isNonEmptyString(studio.Name)) {
          return { name: studio.Name };
        }
        return;
      }),
      plot: series.Overview ?? null,
      rating: series.OfficialRating ?? null,
      sourceType: 'jellyfin',
      tagline: find(series.Taglines, isNonEmptyString) ?? null,
      tags: series.Tags?.filter(isNonEmptyString) ?? [],
      summary: null,
      type: 'show',
      // mediaItem,
      identifiers: collectJellyfinItemIdentifiers(
        series,
        this.options.mediaSource.uuid,
      ),
      childCount: series.ChildCount ?? undefined,
      artwork: compact([
        this.jellyfinArtworkProjection('poster', series, 'Primary'),
        this.jellyfinArtworkProjection('banner', series, 'Banner'),
        this.jellyfinArtworkProjection('thumbnail', series, 'Thumb'),
      ]),
    };
  }

  private jellyfinApiSeasonInjection(
    season: ApiJellyfinSeason,
  ): Nullable<JellyfinSeason> {
    const parsedReleaseDate = isNonEmptyString(season.PremiereDate)
      ? attemptSync(() => dayjs(season.PremiereDate))
      : null;
    return {
      uuid: v4(),
      externalId: season.Id,
      canonicalId: this.canonicalizer.getCanonicalId(season),
      title: season.Name!,
      sortTitle: titleToSortTitle(season.Name!),
      // originalTitle: season.OriginalTitle ?? null,
      year: season.ProductionYear ?? null,
      mediaSourceId: this.options.mediaSource.uuid,
      libraryId: '', // We can't know this at this point...
      releaseDate: isError(parsedReleaseDate)
        ? null
        : (parsedReleaseDate?.valueOf() ?? null),
      releaseDateString: season.PremiereDate ?? null,
      // actors: people['actor'] ?? [],
      // Consider adding this
      // writers: people['writer'] ?? [],
      // genres:
      //   season.Genres?.map((genre) => ({
      //     name: genre,
      //   })) ?? [],
      studios: seq.collect(season.Studios, (studio) => {
        if (isNonEmptyString(studio.Name)) {
          return { name: studio.Name };
        }
        return;
      }),
      plot: season.Overview ?? null,
      // rating: season.OfficialRating ?? null,
      sourceType: 'jellyfin',
      tagline: find(season.Taglines, isNonEmptyString) ?? null,
      tags: season.Tags?.filter(isNonEmptyString) ?? [],
      summary: null,
      type: 'season',
      // mediaItem,
      identifiers: collectJellyfinItemIdentifiers(
        season,
        this.options.mediaSource.uuid,
      ),
      index:
        season.IndexNumber ?? getSeasonNumberFromPath(season.Path ?? '') ?? 0,
      childCount: season.ChildCount ?? undefined,
      artwork: compact([
        this.jellyfinArtworkProjection('poster', season, 'Primary'),
        this.jellyfinArtworkProjection('banner', season, 'Banner'),
        this.jellyfinArtworkProjection('thumbnail', season, 'Thumb'),
      ]),
    };
  }

  private jellyfinApiEpisodeInjection(
    episode: ApiJellyfinEpisode,
  ): Nullable<JellyfinEpisode> {
    if (isEmpty(episode.Name)) {
      this.logger.warn(
        'Jellyfin episode ID = %s missing title. Skipping',
        episode.Id,
      );
      return null;
    }

    const people = getJellyfinItemPersonMap(
      episode,
      this.options.mediaSource.uri,
    );
    const parsedReleaseDate = isNonEmptyString(episode.PremiereDate)
      ? attemptSync(() => dayjs(episode.PremiereDate))
      : null;
    const mediaItem = this.jellyfinApiMediaSourcesInjection(
      episode,
      episode.MediaSources ?? [],
    );

    if (!episode.RunTimeTicks || episode.RunTimeTicks <= 0) {
      return null;
    }

    if (!mediaItem) {
      return null;
    }

    const showJoin = episode.SeriesId
      ? ({
          type: 'show',
          sourceType: 'jellyfin',
          actors: [],
          identifiers: [
            {
              type: 'jellyfin',
              id: episode.SeriesId,
              sourceId: this.options.mediaSource.uuid,
            },
          ],
          title: episode.SeriesName ?? '',
          genres: [],
          studios: [],
          rating: null,
          releaseDate: null,
          releaseDateString: null,
          year: null,
          artwork: [],
          summary: null,
          plot: null,
          tagline: null,
          mediaSourceId: this.options.mediaSource.uuid,
          libraryId: '',
          uuid: v4(),
          canonicalId: '???',
          externalId: episode.SeriesId,
          sortTitle: episode.SeriesName
            ? titleToSortTitle(episode.SeriesName)
            : '',
          tags: [],
        } satisfies JellyfinShow)
      : undefined;

    return {
      uuid: v4(),
      externalId: episode.Id,
      canonicalId: this.canonicalizer.getCanonicalId(episode),
      title: episode.Name!,
      sortTitle: titleToSortTitle(episode.Name!),
      originalTitle: episode.OriginalTitle ?? null,
      year: episode.ProductionYear ?? null,
      releaseDate: isError(parsedReleaseDate)
        ? null
        : (parsedReleaseDate?.valueOf() ?? null),
      releaseDateString: episode.PremiereDate ?? null,
      mediaSourceId: this.options.mediaSource.uuid,
      libraryId: '', // We can't know this at this point...
      actors: people['actor'] ?? [],
      writers: people['writer'] ?? [],
      directors: people['director'] ?? [],
      genres:
        episode.Genres?.map((genre) => ({
          name: genre,
        })) ?? [],
      studios: seq.collect(episode.Studios, (studio) => {
        if (isNonEmptyString(studio.Name)) {
          return { name: studio.Name };
        }
        return;
      }),
      // plot: episode.Overview ?? null,
      episodeNumber: episode.IndexNumber ?? 0,
      // rating: episode.OfficialRating ?? null,
      sourceType: 'jellyfin',
      // tagline: find(episode.Taglines, isNonEmptyString) ?? null,
      tags: episode.Tags?.filter(isNonEmptyString) ?? [],
      summary: episode.Overview ?? null,
      type: 'episode',
      mediaItem,
      identifiers: collectJellyfinItemIdentifiers(
        episode,
        this.options.mediaSource.uuid,
      ),
      duration: episode.RunTimeTicks / 10_000,
      artwork: compact([
        this.jellyfinArtworkProjection('poster', episode, 'Primary'),
        this.jellyfinArtworkProjection('banner', episode, 'Banner'),
        this.jellyfinArtworkProjection('thumbnail', episode, 'Thumb'),
      ]),
      state: 'ok',
      season: episode.SeasonId
        ? ({
            uuid: v4(),
            canonicalId: '???',
            artwork: [],
            externalId: episode.SeasonId,
            identifiers: [
              {
                type: 'jellyfin',
                id: episode.SeasonId,
                sourceId: this.options.mediaSource.uuid,
              },
            ],
            index: episode.ParentIndexNumber ?? 1,
            libraryId: '',
            mediaSourceId: this.options.mediaSource.uuid,
            type: 'season',
            studios: [],
            year: null,
            releaseDate: null,
            releaseDateString: null,
            plot: null,
            sortTitle: episode.SeasonName
              ? titleToSortTitle(episode.SeasonName)
              : `Season ${episode.ParentIndexNumber ?? 1}`,
            sourceType: 'jellyfin',
            summary: null,
            tagline: null,
            title: episode.SeasonName ?? '',
            tags: [],
            show: showJoin,
          } satisfies JellyfinSeason)
        : undefined,
      show: showJoin,
    };
  }

  private jellyfinApiMusicArtistInjection(artist: ApiJellyfinMusicArtist) {
    return {
      title: artist.Name ?? '',
      canonicalId: this.canonicalizer.getCanonicalId(artist),
      genres:
        artist.Genres?.map((genre) => ({
          name: genre,
        })) ?? [],
      identifiers: collectJellyfinItemIdentifiers(
        artist,
        this.options.mediaSource.uuid,
      ),
      plot: null,
      sourceType: 'jellyfin',
      summary: null,
      tagline: null,
      tags: artist.Tags ?? [],
      type: 'artist',
      uuid: v4(),
      libraryId: '',
      mediaSourceId: this.options.mediaSource.uuid,
      childCount: artist.ChildCount ?? undefined,
      externalId: artist.Id,
      sortTitle: titleToSortTitle(artist.Name ?? ''),
      artwork: compact([
        this.jellyfinArtworkProjection('poster', artist, 'Primary'),
        this.jellyfinArtworkProjection('banner', artist, 'Banner'),
        this.jellyfinArtworkProjection('thumbnail', artist, 'Thumb'),
      ]),
    } satisfies JellyfinMusicArtist;
  }

  private jellyfinApiMusicAlbumInjection(
    album: ApiJellyfinMusicAlbum,
  ): JellyfinMusicAlbum {
    return {
      type: 'album',
      externalId: album.Id,
      title: album.Name ?? '',
      sortTitle: titleToSortTitle(album.Name!),
      canonicalId: this.canonicalizer.getCanonicalId(album),
      genres:
        album.Genres?.map((genre) => ({
          name: genre,
        })) ?? [],
      identifiers: collectJellyfinItemIdentifiers(
        album,
        this.options.mediaSource.uuid,
      ),
      plot: null,
      sourceType: 'jellyfin',
      summary: null,
      tagline: null,
      tags: album.Tags ?? [],
      uuid: v4(),
      year: null,
      releaseDate: album.PremiereDate
        ? dayjs(album.PremiereDate)?.valueOf()
        : null,
      releaseDateString: album.PremiereDate ?? null,
      studios: seq.collect(album.Studios, (studio) => {
        if (isNonEmptyString(studio.Name)) {
          return { name: studio.Name };
        }
        return;
      }),
      libraryId: '',
      mediaSourceId: this.options.mediaSource.uuid,
      childCount: album.ChildCount ?? undefined,
      artwork: compact([
        this.jellyfinArtworkProjection('poster', album, 'Primary'),
        this.jellyfinArtworkProjection('banner', album, 'Banner'),
        this.jellyfinArtworkProjection('thumbnail', album, 'Thumb'),
      ]),
    };
  }

  private jellyfinApiMusicTrackInjection(
    track: ApiJellyfinMusicTrack,
  ): Nullable<JellyfinMusicTrack> {
    const mediaItem = this.jellyfinApiMediaSourcesInjection(
      track,
      track.MediaSources ?? [],
    );
    if (!mediaItem) {
      return null;
    }

    if (!track.RunTimeTicks || track.RunTimeTicks <= 0) {
      return null;
    }

    return {
      uuid: v4(),
      canonicalId: this.canonicalizer.getCanonicalId(track),
      title: track.Name ?? '',
      sortTitle: titleToSortTitle(track.Name!),
      actors: [],
      directors: [],
      genres: [],
      tags: track.Tags?.filter(isNonEmptyString) ?? [],
      year: track.ProductionYear ?? null,
      originalTitle: null,
      releaseDate: isNonEmptyString(track.PremiereDate)
        ? dayjs(track.PremiereDate).valueOf()
        : null,
      mediaSourceId: this.options.mediaSource.uuid,
      libraryId: '', // We can't know this at this point...
      identifiers: collectJellyfinItemIdentifiers(
        track,
        this.options.mediaSource.uuid,
      ),
      mediaItem,
      sourceType: 'jellyfin',
      type: 'track',
      studios: [],
      trackNumber: track.IndexNumber ?? 0,
      writers:
        seq.collect(track.AlbumArtists, ({ Name, Id }) =>
          isNonEmptyString(Name)
            ? {
                name: Name,
                externalId: Id,
              }
            : null,
        ) ?? [],
      duration: track.RunTimeTicks / 10_000,
      releaseDateString: track.PremiereDate ?? null,
      externalId: track.Id,
      artwork: compact([
        this.jellyfinArtworkProjection('poster', track, 'Primary'),
        this.jellyfinArtworkProjection('banner', track, 'Banner'),
        this.jellyfinArtworkProjection('thumbnail', track, 'Thumb'),
      ]),
      state: 'ok',
    } satisfies JellyfinMusicTrack;
  }

  private jellyfinApiMusicVideoInjection(
    video: ApiJellyfinMusicVideo,
  ): Nullable<JellyfinMusicVideo> {
    if (isEmpty(video.Name)) {
      this.logger.warn(
        'Jellyfin video ID = %s missing title. Skipping',
        video.Id,
      );
      return null;
    }

    const people = getJellyfinItemPersonMap(
      video,
      this.options.mediaSource.uri,
    );
    const parsedReleaseDate = isNonEmptyString(video.PremiereDate)
      ? attemptSync(() => dayjs(video.PremiereDate))
      : null;
    const mediaItem = this.jellyfinApiMediaSourcesInjection(
      video,
      video.MediaSources ?? [],
    );

    if (!video.RunTimeTicks || video.RunTimeTicks <= 0) {
      return null;
    }

    if (!mediaItem) {
      return null;
    }

    return {
      uuid: v4(),
      canonicalId: this.canonicalizer.getCanonicalId(video),
      title: video.Name!,
      sortTitle: titleToSortTitle(video.Name!),
      originalTitle: video.OriginalTitle ?? null,
      year: video.ProductionYear ?? null,
      releaseDate: isError(parsedReleaseDate)
        ? null
        : (parsedReleaseDate?.valueOf() ?? null),
      releaseDateString: video.PremiereDate ?? null,
      actors: people['actor'] ?? [],
      writers: people['writer'] ?? [],
      directors: people['director'] ?? [],
      genres:
        video.Genres?.map((genre) => ({
          name: genre,
        })) ?? [],
      studios: seq.collect(video.Studios, (studio) => {
        if (isNonEmptyString(studio.Name)) {
          return { name: studio.Name };
        }
        return;
      }),
      // plot: video.Overview ?? null,
      // rating: video.OfficialRating ?? null,
      sourceType: 'jellyfin',
      // tagline: find(video.Taglines, isNonEmptyString) ?? null,
      tags: video.Tags?.filter(isNonEmptyString) ?? [],
      // summary: null,
      type: 'music_video',
      mediaItem,
      identifiers: collectJellyfinItemIdentifiers(
        video,
        this.options.mediaSource.uuid,
      ),
      mediaSourceId: this.options.mediaSource.uuid,
      libraryId: '', // We can't know this at this point...
      duration: video.RunTimeTicks / 10_000,
      externalId: video.Id,
      artwork: compact([
        this.jellyfinArtworkProjection('poster', video, 'Primary'),
        this.jellyfinArtworkProjection('banner', video, 'Banner'),
        this.jellyfinArtworkProjection('thumbnail', video, 'Thumb'),
      ]),
      state: 'ok',
    };
  }

  private jellyfinApiOtherVideoInjection(
    video: ApiJellyfinOtherVideo,
  ): Nullable<JellyfinOtherVideo> {
    if (isEmpty(video.Name)) {
      this.logger.warn(
        'Jellyfin video ID = %s missing title. Skipping',
        video.Id,
      );
      return null;
    }

    const people = getJellyfinItemPersonMap(
      video,
      this.options.mediaSource.uri,
    );
    const parsedReleaseDate = isNonEmptyString(video.PremiereDate)
      ? attemptSync(() => dayjs(video.PremiereDate))
      : null;
    const mediaItem = this.jellyfinApiMediaSourcesInjection(
      video,
      video.MediaSources ?? [],
    );

    if (!video.RunTimeTicks || video.RunTimeTicks <= 0) {
      return null;
    }

    if (!mediaItem) {
      return null;
    }

    return {
      uuid: v4(),
      canonicalId: this.canonicalizer.getCanonicalId(video),
      title: video.Name!,
      sortTitle: titleToSortTitle(video.Name!),
      originalTitle: video.OriginalTitle ?? null,
      year: video.ProductionYear ?? null,
      releaseDate: isError(parsedReleaseDate)
        ? null
        : (parsedReleaseDate?.valueOf() ?? null),
      releaseDateString: video.PremiereDate ?? null,
      actors: people['actor'] ?? [],
      writers: people['writer'] ?? [],
      directors: people['director'] ?? [],
      genres:
        video.Genres?.map((genre) => ({
          name: genre,
        })) ?? [],
      studios: seq.collect(video.Studios, (studio) => {
        if (isNonEmptyString(studio.Name)) {
          return { name: studio.Name };
        }
        return;
      }),
      // plot: video.Overview ?? null,
      // rating: video.OfficialRating ?? null,
      sourceType: 'jellyfin',
      // tagline: find(video.Taglines, isNonEmptyString) ?? null,
      tags: video.Tags?.filter(isNonEmptyString) ?? [],
      // summary: null,
      type: 'other_video',
      mediaItem,
      identifiers: collectJellyfinItemIdentifiers(
        video,
        this.options.mediaSource.uuid,
      ),
      mediaSourceId: this.options.mediaSource.uuid,
      libraryId: '', // We can't know this at this point...
      duration: video.RunTimeTicks / 10_000,
      externalId: video.Id,
      artwork: compact([
        this.jellyfinArtworkProjection('poster', video, 'Primary'),
        this.jellyfinArtworkProjection('banner', video, 'Banner'),
        this.jellyfinArtworkProjection('thumbnail', video, 'Thumb'),
      ]),
      state: 'ok',
    };
  }

  private jellyfinArtworkProjection(
    artworkType: ArtworkType,
    item: ApiJellyfinItem,
    jfArtworkType: string,
  ): Maybe<MediaArtwork> {
    if (isEmpty(item.ImageTags?.[jfArtworkType])) {
      return;
    }

    const url = new URL(
      `/Items/${item.Id}/Images/${jfArtworkType}`,
      this.options.mediaSource.uri,
    ).href;
    return {
      // Explicitly return an empty ID because we cannot know if artwork is persisted or not at this point
      type: artworkType,
      path: url,
    };
  }
}

type PersonMapping = Partial<{
  actor: Actor[];
  writer: Writer[];
  director: Director[];
}>;

function getJellyfinItemPersonMap(
  item: ApiJellyfinItem,
  mediaSourceUrl: string,
): PersonMapping {
  const mapping: PersonMapping = {};
  forEach(
    groupBy(item.People, (p) => p.Type?.toLowerCase()),
    (people, key) => {
      switch (key) {
        case 'actor':
          mapping[key] = people.map(
            (person, idx) =>
              ({
                name: person.Name,
                role: person.Role ?? undefined,
                thumb: new URL(
                  `/Items/${person.Id}/Images/Primary`,
                  mediaSourceUrl,
                ).href,
                order: idx,
              }) satisfies Actor,
          );
          break;
        case 'writer':
          mapping[key] = people.map(
            (person) =>
              ({
                name: person.Name,
                thumb: new URL(
                  `/Items/${person.Id}/Images/Primary`,
                  mediaSourceUrl,
                ).href,
              }) satisfies Writer,
          );
          break;
        case 'director': {
          mapping[key] = people.map(
            (person) =>
              ({
                name: person.Name,
                thumb: new URL(
                  `/Items/${person.Id}/Images/Primary`,
                  mediaSourceUrl,
                ).href,
              }) satisfies Director,
          );
          return;
        }
        default:
          return;
      }
    },
  );
  return mapping;
}

function collectJellyfinItemIdentifiers(
  item: ApiJellyfinItem,
  serverId: string,
): Identifier[] {
  return [
    {
      type: 'jellyfin',
      id: item.Id,
      sourceId: serverId,
    },
    ...seq.collectMapValues(item.ProviderIds, (id, key) => {
      if (!isNonEmptyString(id)) {
        return;
      }

      const k = key?.toLowerCase();
      switch (k) {
        case 'imdb':
        case 'tmdb':
        case 'tvdb':
          return {
            id: id,
            type: k,
          } satisfies Identifier;
        default:
          return;
      }
    }),
  ];
}

const seasonRe = /s(eason)?\s*(\d+).*/i;
function getSeasonNumberFromPath(path: string): Nullable<number> {
  let num: Nullable<number> = parseIntOrNull(path);
  if (!isNull(num)) {
    return num;
  }

  const match = path.match(seasonRe);
  if (match && match.length > 1) {
    num = parseInt(match[1]!);
    if (!isNull(num)) return num;
  }

  if (path.toLowerCase().includes('special')) {
    return 0;
  }

  return null;
}
