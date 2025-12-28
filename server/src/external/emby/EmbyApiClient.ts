import { EmbyRequestRedacter } from '@/external/emby/EmbyRequestRedacter.js';
import type { Maybe, Nilable, Nullable } from '@/types/util.js';
import {
  attemptSync,
  caughtErrorToError,
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
  Writer,
} from '@tunarr/types';
import type { MediaSourceStatus } from '@tunarr/types/api';
import type { EmbyLibrary, EmbyMediaSourceInfo } from '@tunarr/types/emby';
import {
  EmbyAuthenticationResultSchema,
  EmbyLibraryItemsResponse,
  EmbyLibraryResponse,
  EmbySystemInfo,
  EmbyUserSchema,
  type EmbyItem as ApiEmbyItem,
  type EmbyItemField,
  type EmbyItemKind,
  type EmbyItemSortBy,
} from '@tunarr/types/emby';
import type { AxiosRequestConfig } from 'axios';
import axios, { isAxiosError } from 'axios';
import dayjs from 'dayjs';
import {
  compact,
  find,
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
  union,
  uniq,
} from 'lodash-es';
import { type NonEmptyArray } from 'ts-essentials';
import { match, P } from 'ts-pattern';
import { v4 } from 'uuid';
import { z } from 'zod/v4';
import type { ArtworkType } from '../../db/schema/Artwork.ts';
import type { ProgramType } from '../../db/schema/Program.ts';
import type { ProgramGroupingType } from '../../db/schema/ProgramGrouping.ts';
import type { Canonicalizer } from '../../services/Canonicalizer.ts';
import { extractIsAnamorphic } from '../../stream/jellyfin/JellyfinStreamDetails.ts';
import {
  isEmbyType,
  type EmbyEpisode as ApiEmbyEpisode,
  type EmbyMovie as ApiEmbyMovie,
  type EmbyMusicAlbum as ApiEmbyMusicAlbum,
  type EmbyMusicArtist as ApiEmbyMusicArtist,
  type EmbyMusicTrack as ApiEmbyMusicTrack,
  type EmbyMusicVideo as ApiEmbyMusicVideo,
  type EmbyOtherVideo as ApiEmbyOtherVideo,
  type EmbySeason as ApiEmbySeason,
  type EmbySeries as ApiEmbySeries,
  type SpecificEmbyType,
} from '../../types/EmbyTypes.ts';
import type {
  EmbyEpisode,
  EmbyItem,
  EmbyMovie,
  EmbyMusicAlbum,
  EmbyMusicArtist,
  EmbyMusicTrack,
  EmbyMusicVideo,
  EmbyOtherVideo,
  EmbySeason,
  EmbyShow,
  Identifier,
  MediaItem,
  MediaStream,
} from '../../types/Media.ts';
import { Result } from '../../types/result.ts';
import { titleToSortTitle } from '../../util/programs.ts';
import {
  QueryError,
  type ApiClientOptions,
  type QueryResult,
} from '../BaseApiClient.ts';
import { MediaSourceApiClient } from '../MediaSourceApiClient.ts';

const RequiredLibraryFields = [
  'Path',
  'Genres',
  // 'Tags',
  'DateCreated',
  'Etag',
  'Overview',
  'Taglines',
  'Studios',
  'People',
  // 'OfficialRating',
  'ProviderIds',
  'Chapters',
  'PremiereDate',
  'MediaSources',
];

function getEmbyAuthorization(apiKey: Maybe<string>, clientId: Maybe<string>) {
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

  return `Emby ${parts.join(', ')}`;
}

export type EmbyGetItemsQuery = {
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
  artistType?: ('Artist' | 'AlbumArtist')[];
  albumArtistIds?: string[];
};

type EmbyItemTypes = {
  [ProgramType.Movie]: EmbyMovie;
  [ProgramGroupingType.Show]: EmbyShow;
  [ProgramGroupingType.Season]: EmbySeason;
  [ProgramType.Episode]: EmbyEpisode;
  [ProgramGroupingType.Artist]: EmbyMusicArtist;
  [ProgramGroupingType.Album]: EmbyMusicAlbum;
  [ProgramType.Track]: EmbyMusicTrack;
};

export class EmbyApiClient extends MediaSourceApiClient<EmbyItemTypes> {
  protected redacter = new EmbyRequestRedacter();

  constructor(
    private canonicalizer: Canonicalizer<ApiEmbyItem>,
    options: ApiClientOptions,
  ) {
    if (!options.mediaSource.uri.endsWith('/emby')) {
      options.mediaSource.uri += '/emby';
    }

    super({
      ...options,
      extraHeaders: {
        ...options.extraHeaders,
        Accept: 'application/json',
        // Authorization: getEmbyAuthorization(options.accessToken, undefined),
        'X-Emby-Token': options.mediaSource.accessToken,
      },
    });
  }

  static async findUserId(
    server: Omit<ApiClientOptions, 'apiKey' | 'type'>,
    apiKey: string,
    errorExpected: boolean = false,
  ) {
    try {
      const response = await axios.get(`${server.mediaSource.uri}/Users/Me`, {
        headers: {
          Authorization: getEmbyAuthorization(apiKey, undefined),
        },
      });

      return EmbyUserSchema.parseAsync(response.data);
    } catch (error) {
      if (isAxiosError(error)) {
        if (error.config) {
          new EmbyRequestRedacter().redact(error.config);
        }
      }

      if (!errorExpected) {
        LoggerFactory.root.error(
          { error: error as unknown, caller: EmbyApiClient.name },
          'Error retrieving Emby self user',
        );
      }
      return;
    }
  }

  static async findAdminUser(
    server: Omit<ApiClientOptions, 'apiKey' | 'type'>,
    apiKey: string,
  ) {
    try {
      const response = await axios.get(`${server.mediaSource.uri}/Users`, {
        headers: {
          Authorization: getEmbyAuthorization(apiKey, undefined),
        },
      });

      const users = await z.array(EmbyUserSchema).parseAsync(response.data);

      return find(
        users,
        (user) =>
          !!user.Policy?.IsAdministrator &&
          !user.Policy?.IsDisabled &&
          !!user.Policy?.EnableAllFolders,
      );
    } catch (e) {
      LoggerFactory.root.error(
        { error: caughtErrorToError(e), caller: EmbyApiClient.name },
        'Error retrieving Emby users',
      );
      return;
    }
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
            Authorization: getEmbyAuthorization(undefined, clientId),
          },
        },
      );

      return await EmbyAuthenticationResultSchema.parseAsync(response.data);
    } catch (e) {
      if (isAxiosError(e) && e.config) {
        new EmbyRequestRedacter().redact(e.config);
      }

      LoggerFactory.root.error(
        { error: e as unknown, className: EmbyApiClient.name },
        'Error logging into Emby',
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
    return this.doTypeCheckedGet('/System/Info', EmbySystemInfo);
  }

  async getUserLibraries(userId?: string) {
    return this.doTypeCheckedGet(
      '/Library/VirtualFolders',
      EmbyLibraryResponse,
      { params: { userId } },
    ).then((_) =>
      _.mapPure((data) =>
        seq.collect(data, (folder) => this.virtualFolderToLibrary(folder)),
      ),
    );
  }

  async getUserViewsRaw(userId?: string) {
    userId ??= this.options.mediaSource.userId ?? undefined;
    return this.doTypeCheckedGet(
      `/Users/${userId}/Views`,
      EmbyLibraryItemsResponse,
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
    return this.getUserLibraries();
  }

  private virtualFolderToLibrary(lib: EmbyLibrary) {
    return {
      type: 'library',
      externalId: lib.ItemId,
      locations: lib.LibraryOptions.PathInfos.map((path) => ({
        type: 'local',
        path: path.Path,
      })),
      sourceType: 'emby',
      title: lib.Name,
      uuid: v4(),
      childType: match(lib.CollectionType)
        .returnType<Folder['childType']>()
        .with('movies', () => 'movie')
        .with('musicvideos', () => 'music_video')
        .with('tvshows', () => 'show')
        .with('music', () => 'artist')
        .with(P.union('homevideos', 'unknown'), () => 'other_video')
        .otherwise(() => undefined),
    } satisfies Library;
  }

  async getItem(
    itemId: string,
    extraFields: EmbyItemField[] = [],
  ): Promise<QueryResult<Maybe<ApiEmbyItem>>> {
    const result = await this.getRawItems(
      null,
      null,
      null,
      ['MediaStreams', ...extraFields],
      { offset: 0, limit: 1 },
      {
        ids: [itemId],
        recursive: false,
      },
    );

    return result.mapPure(({ Items }) =>
      find(Items, (item) => item.Id === itemId),
    );
  }

  async getRawItems(
    userId: Nilable<string>, // Not required if we are using an access token
    parentId: Nilable<string>,
    itemTypes: Nilable<EmbyItemKind[]> = null,
    extraFields: EmbyItemField[] = [],
    pageParams: Nilable<{ offset: number; limit: number }> = null,
    extraParams: EmbyGetItemsQuery = {},
    sortBy: NonEmptyArray<EmbyItemSortBy> = ['SortName', 'ProductionYear'],
  ) {
    // const userId = userId ?? this.options.mediaSource.userId;
    // const endpoint = isNonEmptyString(userId) ? `/`
    return this.doTypeCheckedGet(
      extraParams.artistType?.includes('AlbumArtist')
        ? '/Artists/AlbumArtists'
        : '/Items',
      EmbyLibraryItemsResponse,
      {
        params: omitBy(
          {
            userId: userId ?? this.options.mediaSource.userId,
            parentId: parentId,
            fields: uniq(union(extraFields, RequiredLibraryFields)).join(','),
            startIndex: pageParams?.offset,
            limit: pageParams?.limit,
            // These will be configurable eventually
            sortOrder: 'Ascending',
            sortBy: sortBy.join(','),
            recursive: extraParams.recursive?.toString() ?? 'true',
            includeItemTypes:
              !extraParams.artistType?.includes('AlbumArtist') && itemTypes
                ? itemTypes.join(',')
                : undefined,
            ...{
              ...mapValues(extraParams, (v) =>
                isBoolean(v) ? v.toString() : v,
              ),
              ids: extraParams.ids?.join(','),
              genres: extraParams.genres?.join('|'),
              artistType: extraParams.artistType?.join(','),
              albumArtistIds: extraParams.albumArtistIds?.join(','),
            },
          },
          (v) => isNil(v) || (!isNumber(v) && isEmpty(v)),
        ),
      },
    );
  }

  async getItems(
    userId: Nilable<string>, // Not required if we are using an access token
    libraryId: Nilable<string>,
    itemTypes: Nilable<EmbyItemKind[]> = null,
    extraFields: EmbyItemField[] = [],
    pageParams: Nilable<{ offset: number; limit: number }> = null,
    extraParams: EmbyGetItemsQuery = {},
    sortBy: NonEmptyArray<EmbyItemSortBy> = ['SortName', 'ProductionYear'],
  ) {
    return (
      await this.getRawItems(
        userId,
        libraryId,
        itemTypes,
        extraFields,
        pageParams,
        extraParams,
        sortBy,
      )
    ).mapPure((data) => {
      const out = seq.collect(data.Items, (item) =>
        this.embyApiItemInjection(item),
      );

      return {
        total: data.TotalRecordCount,
        result: out,
        size: out.length,
        offset: data.StartIndex ?? undefined,
      };
    });
  }

  getThumbUrl(id: string, imageType: 'Primary' | 'Thumb') {
    // Naive impl for now...
    return `${this.options.mediaSource.uri}/Items/${id}/Images/${imageType}`;
  }

  getExternalUrl(id: string) {
    //TODO: This might need a server ID
    return `${this.options.mediaSource.uri}/web/#/item?id=${id}`;
  }

  async getSubtitles(
    itemId: string,
    mediaItemId: string,
    streamIndex: number,
    subtitleFormat: string,
  ): Promise<QueryResult<string>> {
    const subtitlesResult = await this.doGet<string>({
      url: `/Videos/${itemId}/${mediaItemId}/Subtitles/${streamIndex}/Stream.${subtitleFormat}`,
    });

    if (isError(subtitlesResult)) {
      return this.makeErrorResult('generic_request_error');
    }

    return this.makeSuccessResult(subtitlesResult);
  }

  async recordPlaybackStart(itemId: string, deviceId: string) {
    return this.doPost({
      url: '/Sessions/Playing',
      params: {
        userId: this.options.mediaSource.userId,
      },
      headers: {
        Authorization: getEmbyAuthorization(
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
        Authorization: getEmbyAuthorization(
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

  getMovieLibraryContents(
    libraryId: string,
    pageSize?: number,
  ): AsyncIterable<EmbyMovie> {
    return this.getChildContents(
      'Movie',
      (movie) => this.embyApiMovieInjection(movie),
      (page) =>
        this.getRawItems(
          null,
          libraryId,
          ['Movie'],
          [
            'Path',
            'Genres',
            'Tags',
            'DateCreated',
            'Etag',
            'Overview',
            'Taglines',
            'Studios',
            'People',
            'ProductionYear',
            'PremiereDate',
            'MediaSources',
            'OfficialRating',
            'ProviderIds',
            'Chapters',
          ],
          {
            offset: page * (pageSize ?? 50),
            limit: pageSize ?? 50,
          },
        ),
      pageSize,
    );
  }

  getTvShowLibraryContents(
    libraryId: string,
    pageSize?: number,
  ): AsyncIterable<EmbyShow> {
    return this.getChildContents(
      'Series',
      (series) => this.embyApiShowInjection(series),
      (page) =>
        this.getRawItems(
          null,
          libraryId,
          ['Series'],
          [
            'Path',
            'Genres',
            'Tags',
            'DateCreated',
            'Etag',
            'Overview',
            'Taglines',
            'Studios',
            'People',
            'ProductionYear',
            'PremiereDate',
            'MediaSources',
            'OfficialRating',
            'ProviderIds',
          ],
          {
            offset: page * (pageSize ?? 50),
            limit: pageSize ?? 50,
          },
        ),
      pageSize,
    );
  }

  async getMovie(externalKey: string): Promise<QueryResult<EmbyMovie>> {
    return this.getItemOfType(externalKey, 'Movie', (movie) =>
      this.embyApiMovieInjection(movie),
    );
  }

  async getEpisode(externalKey: string): Promise<QueryResult<EmbyEpisode>> {
    return this.getItemOfType(externalKey, 'Episode', (episode) =>
      this.embyApiEpisodeInjection(episode),
    );
  }

  async getShow(externalKey: string): Promise<QueryResult<EmbyShow>> {
    return this.getItemOfType(externalKey, 'Series', (series) =>
      this.embyApiShowInjection(series),
    );
  }

  getSeason(externalKey: string): Promise<QueryResult<EmbySeason>> {
    return this.getItemOfType(externalKey, 'Season', (series) =>
      this.embyApiSeasonInjection(series),
    );
  }

  getShowSeasons(showId: string, pageSize?: number): AsyncIterable<EmbySeason> {
    return this.getChildContents(
      'Season',
      (season) => this.embyApiSeasonInjection(season),
      (page) =>
        this.doTypeCheckedGet(
          `/Shows/${showId}/Seasons`,
          EmbyLibraryItemsResponse,
          {
            params: {
              userId: this.options.mediaSource.userId,
              fields: 'Path,DateCreated,Etag,Taglines,ProviderIds',
              startIndex: page * (pageSize ?? 50),
              limit: pageSize ?? 50,
              sortOrder: 'Ascending',
              sortBy: ['SortName', 'ProductionYear'].join(','),
            },
          },
        ),
      pageSize,
    );
  }

  getSeasonEpisodes(
    showId: string,
    seasonId: string,
    pageSize?: number,
  ): AsyncIterable<EmbyEpisode> {
    return this.getChildContents(
      // this.options.mediaSource.userId,
      // seasonKey,
      'Episode',
      (episode) => this.embyApiEpisodeInjection(episode),
      (page) =>
        this.doTypeCheckedGet(
          `/Shows/${showId}/Seasons`,
          EmbyLibraryItemsResponse,
          {
            params: {
              userId: this.options.mediaSource.userId,
              fields: 'Path,DateCreated,Etag,Taglines,ProviderIds',
              startIndex: page * (pageSize ?? 50),
              limit: pageSize ?? 50,
              sortOrder: 'Ascending',
              sortBy: ['SortName', 'ProductionYear'].join(','),
              seasonId,
            },
          },
        ),
      pageSize,
    );
  }

  getMusicLibraryContents(
    libraryId: string,
    pageSize: number,
  ): AsyncIterable<EmbyMusicArtist> {
    return this.getChildContents(
      'MusicArtist',
      (movie) => this.embyApiMusicArtistInjection(movie),
      (page) =>
        this.doTypeCheckedGet(
          '/Artists/AlbumArtists',
          EmbyLibraryItemsResponse,
          {
            params: {
              parentId: libraryId,
              sortOrder: 'Ascending',
              sortBy: 'SortName',
              artistType: ['AlbumArtist'],
              fields: [
                'Genres',
                'MediaStreams',
                'ETag',
                'Path',
                'ProviderIds',
                'SortName',
                'Studios',
                'Taglines',
                'Overview',
              ].join(','),
              startIndex: page * (pageSize ?? 50),
              limit: pageSize ?? 50,
            },
          },
        ),
      pageSize,
    );
  }

  getArtistAlbums(
    artistKey: string,
    pageSize: number,
  ): AsyncIterable<EmbyMusicAlbum> {
    return this.getChildContents(
      'MusicAlbum',
      (album) => this.embyApiMusicAlbumInjection(album),
      (page) =>
        this.getRawItems(
          null,
          null,
          ['MusicAlbum'],
          [],
          {
            limit: pageSize ?? 50,
            offset: page * (pageSize ?? 50),
          },
          {
            albumArtistIds: [artistKey],
            recursive: true,
          },
        ),
      pageSize,
    );
  }

  getAlbumTracks(
    albumKey: string,
    pageSize: number,
  ): AsyncIterable<EmbyMusicTrack> {
    return this.getChildContents(
      'Audio',
      (track) => this.embyApiMusicTrackInjection(track),
      (page) =>
        this.getRawItems(
          null,
          albumKey,
          ['Audio'],
          [],
          {
            offset: page * (pageSize ?? 50),
            limit: pageSize ?? 50,
          },
          {
            recursive: true,
          },
        ),
      pageSize,
    );
  }

  getMusicArtist(key: string): Promise<QueryResult<EmbyMusicArtist>> {
    return this.getItemOfType(key, 'MusicArtist', (track) =>
      this.embyApiMusicArtistInjection(track),
    );
  }

  getMusicAlbum(key: string): Promise<QueryResult<EmbyMusicAlbum>> {
    return this.getItemOfType(key, 'MusicAlbum', (track) =>
      this.embyApiMusicAlbumInjection(track),
    );
  }

  async getMusicTrack(key: string): Promise<QueryResult<EmbyMusicTrack>> {
    return this.getItemOfType(key, 'Audio', (track) =>
      this.embyApiMusicTrackInjection(track),
    );
  }

  private async getItemOfType<
    ItemTypeT extends EmbyItemKind,
    OutType = SpecificEmbyType<ItemTypeT>,
  >(
    itemId: string,
    itemType: ItemTypeT,
    converter: (item: SpecificEmbyType<ItemTypeT>) => Nullable<OutType>,
    extraFields: EmbyItemField[] = [],
  ): Promise<QueryResult<OutType>> {
    return this.getItem(itemId, extraFields).then((result) => {
      return result.flatMap((item) => {
        if (!item) {
          return this.makeErrorResult(
            'not_found',
            `Could not find Emby item with ID = ${itemId} of type ${itemType}`,
          );
        }

        if (!isEmbyType(item, itemType)) {
          return this.makeErrorResult(
            'generic_request_error',
            `Expected item of type ${itemType} for Emby item ${itemId}, but got ${item.Type}`,
          );
        }

        return Result.attempt(() => converter(item)).ifNil(
          QueryError.create(
            'generic_request_error',
            `Could not convert Emby item with id = ${itemId}`,
          ),
        );
      });
    });
  }

  private async *getChildContents<ItemTypeT extends EmbyItemKind, OutType>(
    // userId: Nilable<string>, // Not required if we are using an access token
    // parentId: string,
    itemType: ItemTypeT,
    converter: (item: SpecificEmbyType<ItemTypeT>) => Nullable<OutType>,
    // extraFields: EmbyItemField[] = [],
    // extraParams: EmbyGetItemsQuery = {},
    getter: (page: number) => Promise<QueryResult<EmbyLibraryItemsResponse>>,
    pageSize: number = 50,
    //  = (
    //   page,
    // ) =>
    //   this.getRawItems(
    //     userId,
    //     parentId,
    //     [itemType],
    //     extraFields,
    //     {
    //       offset: page * pageSize,
    //       limit: pageSize,
    //     },
    //     extraParams,
    //   ),
  ): AsyncIterable<OutType> {
    let totalPages = Number.MAX_SAFE_INTEGER;

    for (let page = 0; page <= totalPages; page++) {
      const chunkResult = await getter(page);

      if (chunkResult.isFailure()) {
        throw chunkResult.error;
      }

      const pageResult = chunkResult.get();

      totalPages = Math.min(
        totalPages,
        Math.ceil(pageResult.TotalRecordCount / pageSize),
      );

      for (const item of pageResult.Items ?? []) {
        if (isEmbyType(item, itemType)) {
          const convertedResult = Result.attempt(() => converter(item));
          if (convertedResult.isFailure()) {
            this.logger.error(
              convertedResult.error,
              'Failure converting Emby item %s',
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

  async getChildItemCount(parentId: string, itemType: EmbyItemKind) {
    const endpoint =
      itemType === 'MusicArtist' ? '/Artists/AlbumArtists' : '/Items';
    return this.doTypeCheckedGet(endpoint, EmbyLibraryItemsResponse, {
      params: {
        userId: this.options.mediaSource.userId,
        parentId,
        startIndex: 0,
        limit: 0,
        recursive: true,
      },
    }).then((_) => _.map((response) => response.TotalRecordCount));
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
      return this.makeErrorResult('no_access_token', 'No Emby token provided.');
    }
    return super.preRequestValidate(req);
  }

  private embyApiItemInjection(item: ApiEmbyItem) {
    return match(item)
      .returnType<EmbyItem | Folder | null>()
      .with({ Type: 'Movie' }, (m) => this.embyApiMovieInjection(m))
      .with({ Type: 'Series' }, (m) => this.embyApiShowInjection(m))
      .with({ Type: 'Season' }, (m) => this.embyApiSeasonInjection(m))
      .with({ Type: 'Episode' }, (m) => this.embyApiEpisodeInjection(m))
      .with({ Type: 'MusicArtist' }, (a) => this.embyApiMusicArtistInjection(a))
      .with({ Type: 'MusicAlbum' }, (a) => this.embyApiMusicAlbumInjection(a))
      .with({ Type: 'Audio' }, (a) => this.embyApiMusicTrackInjection(a))
      .with({ Type: 'MusicVideo' }, (mv) => this.embyApiMusicVideoInjection(mv))
      .with({ Type: 'Video' }, (v) => this.embyApiOtherVideoInjection(v))
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
          sourceType: 'emby',
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

  private embyApiMovieInjection(movie: ApiEmbyMovie): Nullable<EmbyMovie> {
    if (isEmpty(movie.Name)) {
      this.logger.warn('Emby movie ID = %s missing title. Skipping', movie.Id);
      return null;
    }

    const people = getEmbyItemPersonMap(movie, this.options.mediaSource.uri);
    const parsedReleaseDate = isNonEmptyString(movie.PremiereDate)
      ? attemptSync(() => dayjs(movie.PremiereDate))
      : null;
    const mediaItem = this.embyApiMediaSourcesInjection(
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
      sortTitle: titleToSortTitle(movie.Name ?? ''),
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
      sourceType: 'emby',
      tagline: find(movie.Taglines, isNonEmptyString) ?? null,
      tags: movie.Tags?.filter(isNonEmptyString) ?? [],
      summary: null,
      type: 'movie',
      mediaItem,
      identifiers: collectEmbyItemIdentifiers(
        movie,
        this.options.mediaSource.uuid,
      ),
      mediaSourceId: this.options.mediaSource.uuid,
      libraryId: '', // We can't know this at this point...
      duration: movie.RunTimeTicks / 10_000,
      externalId: movie.Id,
      artwork: compact([
        this.embyArtworkProjection('poster', movie, 'Primary'),
        this.embyArtworkProjection('banner', movie, 'Banner'),
        this.embyArtworkProjection('thumbnail', movie, 'Thumb'),
      ]),
      state: 'ok',
    };
  }

  private embyApiMediaSourcesInjection(
    item: ApiEmbyItem,
    sources: EmbyMediaSourceInfo[],
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

    return {
      displayAspectRatio: videoStream.AspectRatio ?? '',
      sampleAspectRatio: isAnamorphic ? '0:0' : '1:1',
      duration: +dayjs.duration(Math.ceil((source.RunTimeTicks ?? 0) / 10_000)),
      frameRate: videoStream.RealFrameRate?.toFixed(2),
      locations: [
        {
          type: 'remote',
          sourceType: 'emby',
          externalKey: item.Id,
          path: source.Path ?? '',
        },
      ],
      streams: [videoMediaStream, ...audioMediaStreams, ...subtitleStreams],
      resolution: {
        widthPx: width,
        heightPx: height,
      },
    };
  }

  private embyApiShowInjection(series: ApiEmbySeries): Nullable<EmbyShow> {
    if (isEmpty(series.Name)) {
      this.logger.warn('Emby movie ID = %s missing title. Skipping', series.Id);
      return null;
    }

    const people = getEmbyItemPersonMap(series, this.options.mediaSource.uri);

    const parsedReleaseDate = isNonEmptyString(series.PremiereDate)
      ? attemptSync(() => dayjs(series.PremiereDate))
      : null;

    return {
      uuid: v4(),
      externalId: series.Id,
      canonicalId: this.canonicalizer.getCanonicalId(series),
      title: series.Name!,
      sortTitle: titleToSortTitle(series.Name ?? ''),
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
      sourceType: 'emby',
      tagline: find(series.Taglines, isNonEmptyString) ?? null,
      tags: series.Tags?.filter(isNonEmptyString) ?? [],
      summary: null,
      type: 'show',
      // mediaItem,
      identifiers: collectEmbyItemIdentifiers(
        series,
        this.options.mediaSource.uuid,
      ),
      childCount: series.ChildCount ?? undefined,
      artwork: compact([
        this.embyArtworkProjection('poster', series, 'Primary'),
        this.embyArtworkProjection('banner', series, 'Banner'),
        this.embyArtworkProjection('thumbnail', series, 'Thumb'),
      ]),
    };
  }

  private embyApiSeasonInjection(season: ApiEmbySeason): Nullable<EmbySeason> {
    const parsedReleaseDate = isNonEmptyString(season.PremiereDate)
      ? attemptSync(() => dayjs(season.PremiereDate))
      : null;
    return {
      uuid: v4(),
      externalId: season.Id,
      canonicalId: this.canonicalizer.getCanonicalId(season),
      title: season.Name!,
      sortTitle: titleToSortTitle(season.Name ?? ''),
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
      sourceType: 'emby',
      tagline: find(season.Taglines, isNonEmptyString) ?? null,
      tags: season.Tags?.filter(isNonEmptyString) ?? [],
      summary: null,
      type: 'season',
      // mediaItem,
      identifiers: collectEmbyItemIdentifiers(
        season,
        this.options.mediaSource.uuid,
      ),
      index:
        season.IndexNumber ?? getSeasonNumberFromPath(season.Path ?? '') ?? 0,
      childCount: season.ChildCount ?? undefined,
      artwork: compact([
        this.embyArtworkProjection('poster', season, 'Primary'),
        this.embyArtworkProjection('banner', season, 'Banner'),
        this.embyArtworkProjection('thumbnail', season, 'Thumb'),
      ]),
    };
  }

  private embyApiEpisodeInjection(
    episode: ApiEmbyEpisode,
  ): Nullable<EmbyEpisode> {
    if (isEmpty(episode.Name)) {
      this.logger.warn(
        'Emby episode ID = %s missing title. Skipping',
        episode.Id,
      );
      return null;
    }

    const people = getEmbyItemPersonMap(episode, this.options.mediaSource.uri);
    const parsedReleaseDate = isNonEmptyString(episode.PremiereDate)
      ? attemptSync(() => dayjs(episode.PremiereDate))
      : null;
    const mediaItem = this.embyApiMediaSourcesInjection(
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
          sourceType: 'emby',
          actors: [],
          identifiers: [
            {
              type: 'emby',
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
        } satisfies EmbyShow)
      : undefined;

    return {
      uuid: v4(),
      externalId: episode.Id,
      canonicalId: this.canonicalizer.getCanonicalId(episode),
      title: episode.Name!,
      sortTitle: titleToSortTitle(episode.Name ?? ''),
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
      sourceType: 'emby',
      // tagline: find(episode.Taglines, isNonEmptyString) ?? null,
      tags: episode.Tags?.filter(isNonEmptyString) ?? [],
      summary: episode.Overview ?? null,
      type: 'episode',
      mediaItem,
      identifiers: collectEmbyItemIdentifiers(
        episode,
        this.options.mediaSource.uuid,
      ),
      duration: episode.RunTimeTicks / 10_000,
      artwork: compact([
        this.embyArtworkProjection('poster', episode, 'Primary'),
        this.embyArtworkProjection('banner', episode, 'Banner'),
        this.embyArtworkProjection('thumbnail', episode, 'Thumb'),
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
                type: 'emby',
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
            sourceType: 'emby',
            summary: null,
            tagline: null,
            title: episode.SeasonName ?? '',
            tags: [],
            show: showJoin,
          } satisfies EmbySeason)
        : undefined,
      show: showJoin,
    };
  }

  private embyApiMusicArtistInjection(artist: ApiEmbyMusicArtist) {
    return {
      title: artist.Name ?? '',
      sortTitle: titleToSortTitle(artist.Name ?? ''),
      canonicalId: this.canonicalizer.getCanonicalId(artist),
      genres:
        artist.Genres?.map((genre) => ({
          name: genre,
        })) ?? [],
      identifiers: collectEmbyItemIdentifiers(
        artist,
        this.options.mediaSource.uuid,
      ),
      plot: null,
      sourceType: 'emby',
      summary: null,
      tagline: null,
      tags: artist.Tags ?? [],
      type: 'artist',
      uuid: v4(),
      libraryId: '',
      mediaSourceId: this.options.mediaSource.uuid,
      childCount: artist.ChildCount ?? undefined,
      externalId: artist.Id,
      artwork: compact([
        this.embyArtworkProjection('poster', artist, 'Primary'),
        this.embyArtworkProjection('banner', artist, 'Banner'),
        this.embyArtworkProjection('thumbnail', artist, 'Thumb'),
      ]),
    } satisfies EmbyMusicArtist;
  }

  private embyApiMusicAlbumInjection(album: ApiEmbyMusicAlbum): EmbyMusicAlbum {
    return {
      type: 'album',
      externalId: album.Id,
      title: album.Name ?? '',
      sortTitle: titleToSortTitle(album.Name ?? ''),
      canonicalId: this.canonicalizer.getCanonicalId(album),
      genres:
        album.Genres?.map((genre) => ({
          name: genre,
        })) ?? [],
      identifiers: collectEmbyItemIdentifiers(
        album,
        this.options.mediaSource.uuid,
      ),
      plot: null,
      sourceType: 'emby',
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
        this.embyArtworkProjection('poster', album, 'Primary'),
        this.embyArtworkProjection('banner', album, 'Banner'),
        this.embyArtworkProjection('thumbnail', album, 'Thumb'),
      ]),
    };
  }

  private embyApiMusicTrackInjection(
    track: ApiEmbyMusicTrack,
  ): Nullable<EmbyMusicTrack> {
    const mediaItem = this.embyApiMediaSourcesInjection(
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
      sortTitle: titleToSortTitle(track.Name ?? ''),
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
      identifiers: collectEmbyItemIdentifiers(
        track,
        this.options.mediaSource.uuid,
      ),
      mediaItem,
      sourceType: 'emby',
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
        this.embyArtworkProjection('poster', track, 'Primary'),
        this.embyArtworkProjection('banner', track, 'Banner'),
        this.embyArtworkProjection('thumbnail', track, 'Thumb'),
      ]),
      state: 'ok',
    } satisfies EmbyMusicTrack;
  }

  private embyApiMusicVideoInjection(
    video: ApiEmbyMusicVideo,
  ): Nullable<EmbyMusicVideo> {
    if (isEmpty(video.Name)) {
      this.logger.warn('Emby video ID = %s missing title. Skipping', video.Id);
      return null;
    }

    const people = getEmbyItemPersonMap(video, this.options.mediaSource.uri);
    const parsedReleaseDate = isNonEmptyString(video.PremiereDate)
      ? attemptSync(() => dayjs(video.PremiereDate))
      : null;
    const mediaItem = this.embyApiMediaSourcesInjection(
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
      sortTitle: titleToSortTitle(video.Name ?? ''),
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
      sourceType: 'emby',
      // tagline: find(video.Taglines, isNonEmptyString) ?? null,
      tags: video.Tags?.filter(isNonEmptyString) ?? [],
      // summary: null,
      type: 'music_video',
      mediaItem,
      identifiers: collectEmbyItemIdentifiers(
        video,
        this.options.mediaSource.uuid,
      ),
      mediaSourceId: this.options.mediaSource.uuid,
      libraryId: '', // We can't know this at this point...
      duration: video.RunTimeTicks / 10_000,
      externalId: video.Id,
      artwork: compact([
        this.embyArtworkProjection('poster', video, 'Primary'),
        this.embyArtworkProjection('banner', video, 'Banner'),
        this.embyArtworkProjection('thumbnail', video, 'Thumb'),
      ]),
      state: 'ok',
    };
  }

  private embyApiOtherVideoInjection(
    video: ApiEmbyOtherVideo,
  ): Nullable<EmbyOtherVideo> {
    if (isEmpty(video.Name)) {
      this.logger.warn('Emby video ID = %s missing title. Skipping', video.Id);
      return null;
    }

    const people = getEmbyItemPersonMap(video, this.options.mediaSource.uri);
    const parsedReleaseDate = isNonEmptyString(video.PremiereDate)
      ? attemptSync(() => dayjs(video.PremiereDate))
      : null;
    const mediaItem = this.embyApiMediaSourcesInjection(
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
      sortTitle: titleToSortTitle(video.Name ?? ''),
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
      sourceType: 'emby',
      // tagline: find(video.Taglines, isNonEmptyString) ?? null,
      tags: video.Tags?.filter(isNonEmptyString) ?? [],
      // summary: null,
      type: 'other_video',
      mediaItem,
      identifiers: collectEmbyItemIdentifiers(
        video,
        this.options.mediaSource.uuid,
      ),
      mediaSourceId: this.options.mediaSource.uuid,
      libraryId: '', // We can't know this at this point...
      duration: video.RunTimeTicks / 10_000,
      externalId: video.Id,
      artwork: compact([
        this.embyArtworkProjection('poster', video, 'Primary'),
        this.embyArtworkProjection('banner', video, 'Banner'),
        this.embyArtworkProjection('thumbnail', video, 'Thumb'),
      ]),
      state: 'ok',
    };
  }

  private embyArtworkProjection(
    artworkType: ArtworkType,
    item: ApiEmbyItem,
    embyArtworkType: string,
  ): Maybe<MediaArtwork> {
    if (isEmpty(item.ImageTags?.[embyArtworkType])) {
      return;
    }

    const url = new URL(
      `/Items/${item.Id}/Images/${embyArtworkType}`,
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

function getEmbyItemPersonMap(
  item: ApiEmbyItem,
  mediaSourceUrl: string,
): PersonMapping {
  const mapping: PersonMapping = {};
  forEach(
    groupBy(item.People, (p) => p.Type?.toLowerCase()),
    (people, key) => {
      switch (key) {
        case 'actor':
          mapping[key] = seq.collect(people, (person, idx) =>
            isNonEmptyString(person.Name)
              ? ({
                  name: person.Name,
                  role: person.Role ?? undefined,
                  thumb: new URL(
                    `/Items/${person.Id}/Images/Primary`,
                    mediaSourceUrl,
                  ).href,
                  order: idx,
                } satisfies Actor)
              : null,
          );
          break;
        case 'writer':
          mapping[key] = seq.collect(people, (person) =>
            isNonEmptyString(person.Name)
              ? ({
                  name: person.Name,
                  thumb: new URL(
                    `/Items/${person.Id}/Images/Primary`,
                    mediaSourceUrl,
                  ).href,
                } satisfies Writer)
              : null,
          );
          break;
        case 'director': {
          mapping[key] = seq.collect(people, (person) =>
            isNonEmptyString(person.Name)
              ? ({
                  name: person.Name,
                  thumb: new URL(
                    `/Items/${person.Id}/Images/Primary`,
                    mediaSourceUrl,
                  ).href,
                } satisfies Director)
              : null,
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
function collectEmbyItemIdentifiers(
  item: ApiEmbyItem,
  serverId: string,
): Identifier[] {
  return [
    {
      type: 'emby',
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
