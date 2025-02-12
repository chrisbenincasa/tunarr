import { JellyfinRequestRedacter } from '@/external/jellyfin/JellyfinRequestRedacter.js';
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
import type { MediaSourceStatus } from '@tunarr/types/api';
import type {
  JellyfinItem,
  JellyfinItemFields,
  JellyfinItemKind,
  JellyfinItemSortBy,
  JellyfinMediaSourceInfo,
} from '@tunarr/types/jellyfin';
import {
  JellyfinAuthenticationResult,
  JellyfinLibraryItemsResponse,
  JellyfinLibraryResponse,
  JellyfinSystemInfo,
  JellyfinUser,
} from '@tunarr/types/jellyfin';
import type { AxiosRequestConfig } from 'axios';
import axios, { isAxiosError } from 'axios';
import dayjs from 'dayjs';
import {
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
} from 'lodash-es';
import type { NonEmptyArray } from 'ts-essentials';
import { v4 } from 'uuid';
import { z } from 'zod/v4';
import type { ProgramType } from '../../db/schema/Program.ts';
import type { ProgramGroupingType } from '../../db/schema/ProgramGrouping.ts';
import type { Canonicalizer } from '../../services/Canonicalizer.ts';
import { extractIsAnamorphic } from '../../stream/jellyfin/JellyfinStreamDetails.ts';
import type {
  JellyfinEpisode as ApiJellyfinEpisode,
  JellyfinMovie as ApiJellyfinMovie,
  JellyfinMusicArtist as ApiJellyfinMusicArtist,
  JellyfinMusicTrack as ApiJellyfinMusicTrack,
  JellyfinSeason as ApiJellyfinSeason,
  JellyfinSeries as ApiJellyfinSeries,
  SpecificJellyfinType,
} from '../../types/JellyfinTypes.ts';
import { isJellyfinType } from '../../types/JellyfinTypes.ts';
import type {
  Identifier,
  JellyfinEpisode,
  JellyfinMovie,
  JellyfinMusicAlbum,
  JellyfinMusicArtist,
  JellyfinMusicTrack,
  JellyfinSeason,
  JellyfinShow,
  MediaItem,
  MediaStream,
  NamedEntity,
} from '../../types/Media.ts';
import { Result } from '../../types/result.ts';
import type { ApiClientOptions, QueryResult } from '../BaseApiClient.js';
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
  'OfficialRating',
  'ProviderIds',
  'Chapters',
  'MediaStreams',
  'MediaSources',
] satisfies JellyfinItemFields[];

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
    private canonicalizer: Canonicalizer<JellyfinItem>,
    options: ApiClientOptions,
  ) {
    super({
      ...options,
      extraHeaders: {
        ...options.extraHeaders,
        Accept: 'application/json',
        Authorization: getJellyfinAuthorization(options.accessToken, undefined),
      },
    });
  }

  static async findUserId(
    server: Omit<ApiClientOptions, 'apiKey' | 'type'>,
    apiKey: string,
    errorExpected: boolean = false,
  ) {
    try {
      const response = await axios.get(`${server.url}/Users/Me`, {
        headers: {
          Authorization: getJellyfinAuthorization(apiKey, undefined),
        },
      });

      return JellyfinUser.parseAsync(response.data);
    } catch (error) {
      if (isAxiosError(error)) {
        if (error.config) {
          new JellyfinRequestRedacter().redact(error.config);
        }
      }

      if (!errorExpected) {
        LoggerFactory.root.error(error, 'Error retrieving Jellyfin users', {
          className: JellyfinApiClient.name,
        });
      }
      return;
    }
  }

  static async findAdminUser(
    server: Omit<ApiClientOptions, 'apiKey' | 'type'>,
    apiKey: string,
  ) {
    try {
      const response = await axios.get(`${server.url}/Users`, {
        headers: {
          Authorization: getJellyfinAuthorization(apiKey, undefined),
        },
      });

      const users = await z.array(JellyfinUser).parseAsync(response.data);

      return find(
        users,
        (user) =>
          !!user.Policy?.IsAdministrator &&
          !user.Policy?.IsDisabled &&
          !!user.Policy?.EnableAllFolders,
      );
    } catch (error) {
      if (isAxiosError(error)) {
        if (error.config) {
          new JellyfinRequestRedacter().redact(error.config);
        }
      }
      LoggerFactory.root.error(error, 'Error retrieving Jellyfin users', {
        className: JellyfinApiClient.name,
      });
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

  async getUserLibraries(userId?: string) {
    return this.doTypeCheckedGet(
      '/Library/VirtualFolders',
      JellyfinLibraryResponse,
      { params: { userId } },
    );
  }

  async getUserViews(userId?: string) {
    return this.doTypeCheckedGet('/UserViews', JellyfinLibraryItemsResponse, {
      params: {
        userId: userId ?? this.options.userId,
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
    });
  }

  async getMovie(itemId: string, extraFields: JellyfinItemFields[] = []) {
    const itemResult = await this.getItemOfType(itemId, 'Movie', extraFields);
    return itemResult.mapPure((maybeItem) =>
      maybeItem ? this.jellyfinApiMovieInjection(maybeItem) : undefined,
    );
  }

  async getEpisode(itemId: string, extraFields: JellyfinItemFields[] = []) {
    const itemResult = await this.getItemOfType(itemId, 'Episode', extraFields);
    return itemResult.mapPure((maybeItem) =>
      maybeItem ? this.jellyfinApiEpisodeInjection(maybeItem) : undefined,
    );
  }

  async getMusicTrack(
    itemId: string,
  ): Promise<QueryResult<JellyfinMusicTrack>> {
    const itemResult = await this.getItemOfType(itemId, 'Audio');
    return itemResult
      .flatMap((maybeItem) => {
        if (!maybeItem) {
          return this.makeErrorResult<ApiJellyfinMusicTrack>('not_found');
        }
        return this.makeSuccessResult(maybeItem);
      })
      .flatMapPure((item) => {
        const result = this.jellyfinApiMusicTrackInjection(item);
        if (!result) {
          return this.makeErrorResult('generic_request_error');
        }
        return this.makeSuccessResult(result);
      });
  }

  private async getItemOfType<ItemTypeT extends JellyfinItemKind>(
    itemId: string,
    itemType: ItemTypeT,
    extraFields: JellyfinItemFields[] = [],
  ): Promise<QueryResult<Maybe<SpecificJellyfinType<ItemTypeT>>>> {
    return this.getItem(itemId, itemType, extraFields).then((result) => {
      return result.mapPure((item) =>
        item && isJellyfinType(item, itemType) ? item : undefined,
      );
    });
  }

  async getItem<ItemTypeT extends JellyfinItemKind>(
    itemId: string,
    itemType: ItemTypeT | null = null,
    extraFields: JellyfinItemFields[] = [],
  ): Promise<QueryResult<Maybe<JellyfinItem>>> {
    const result = await this.getItems(
      null,
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

  async getItems(
    userId: Nilable<string>, // Not required if we are using an access token
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
          userId: userId ?? this.options.userId,
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
            userId: userId ?? this.options.userId,
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
        url: `/Videos/${itemId}/${mediaItemId}/Subtitles/${streamIndex}/${tickOffset}/Stream.${subtitleExt}`,
        params: {
          userId: this.options.userId,
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
      pageSize,
    );
  }

  getTvShowSeasons(
    parentId: string,
    pageSize: number = 50,
  ): AsyncIterable<JellyfinSeason> {
    return this.getChildContents(
      parentId,
      'Season',
      (season) => this.jellyfinApiSeasonInjection(season),
      ['Overview'],
      pageSize,
    );
  }

  getEpisodes(
    parentId: string,
    pageSize: number = 50,
  ): AsyncIterable<JellyfinEpisode> {
    return this.getChildContents(
      parentId,
      'Episode',
      (ep) => this.jellyfinApiEpisodeInjection(ep),
      [],
      pageSize,
    );
  }

  private async *getChildContents<ItemTypeT extends JellyfinItemKind, OutType>(
    parentId: string,
    itemType: ItemTypeT,
    converter: (item: SpecificJellyfinType<ItemTypeT>) => Nullable<OutType>,
    extraFields: JellyfinItemFields[] = [],
    pageSize: number = 50,
  ): AsyncIterable<OutType> {
    const count = await this.getChildItemCount(parentId, itemType);
    if (count.isFailure()) {
      return count;
    }

    const totalPages = Math.ceil(count.get() / pageSize);

    for (let page = 0; page <= totalPages; page++) {
      const chunkResult = await (itemType === 'MusicArtist'
        ? this.getAlbumArtists(null, parentId, extraFields, {
            offset: page * pageSize,
            limit: pageSize,
          })
        : this.getItems(null, parentId, [itemType], extraFields, {
            offset: page * pageSize,
            limit: pageSize,
          }));

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
        userId: this.options.userId,
        parentId,
        startIndex: 0,
        limit: 0,
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
    return `${this.options.url}/Items/${id}/Images/${imageType}`;
  }

  getExternalUrl(id: string) {
    return `${this.options.url}/web/#/details?id=${id}`;
  }

  async getGenres(
    parentId?: string,
    includeItemTypes?: string,
  ): Promise<QueryResult<string>> {
    try {
      const genresResult = await this.doGet<string>({
        url: `/Genres`,
        params: {
          parentId,
          userId: this.options.userId,
          includeItemTypes,
          recursive: 'true',
        },
      });

      return this.makeSuccessResult(genresResult);
    } catch (e) {
      const err = caughtErrorToError(e);
      return this.makeErrorResult('generic_request_error', err.message);
    }
  }

  async recordPlaybackStart(itemId: string, deviceId: string) {
    return this.doPost({
      url: '/Sessions/Playing',
      params: {
        userId: this.options.userId,
      },
      headers: {
        Authorization: getJellyfinAuthorization(
          this.options.accessToken,
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
        userId: this.options.userId,
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
        userId: this.options.userId,
      },
      headers: {
        Authorization: getJellyfinAuthorization(
          this.options.accessToken,
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
    if (isEmpty(this.options.accessToken)) {
      return this.makeErrorResult(
        'no_access_token',
        'No Jellyfin token provided.',
      );
    }
    return super.preRequestValidate(req);
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

    const people = getJellyfinItemPersonMap(movie);
    const parsedReleaseDate = isNonEmptyString(movie.PremiereDate)
      ? attemptSync(() => dayjs(movie.PremiereDate))
      : null;
    const mediaItem = this.jellyfinApiMediaSourcesInjection(
      movie,
      movie.MediaSources ?? [],
    );

    if (!mediaItem) {
      return null;
    }

    return {
      uuid: v4(),
      canonicalId: this.canonicalizer.getCanonicalId(movie),
      title: movie.Name!,
      originalTitle: movie.OriginalTitle ?? null,
      year: movie.ProductionYear ?? null,
      releaseDate: isError(parsedReleaseDate) ? null : parsedReleaseDate,
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
      externalKey: movie.Id,
      mediaItem,
      identifiers: collectJellyfinItemIdentifiers(
        movie,
        this.options.mediaSourceUuid!,
      ),
    };
  }

  private jellyfinApiMediaSourcesInjection(
    item: JellyfinItem,
    sources: JellyfinMediaSourceInfo[],
  ): Maybe<MediaItem> {
    if (sources.length === 0) {
      this.logger.warn('');
      return;
    }

    const source = find(sources, { Protocol: 'File' }) ?? sources[0];

    if (isEmpty(source.MediaStreams)) {
      this.logger.warn('');
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
      duration: dayjs.duration(Math.ceil((source.RunTimeTicks ?? 0) / 10_000)),
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

    const people = getJellyfinItemPersonMap(series);

    const parsedReleaseDate = isNonEmptyString(series.PremiereDate)
      ? attemptSync(() => dayjs(series.PremiereDate))
      : null;

    return {
      uuid: v4(),
      canonicalId: this.canonicalizer.getCanonicalId(series),
      title: series.Name!,
      // originalTitle: series.OriginalTitle ?? null,
      year: series.ProductionYear ?? null,
      releaseDate: isError(parsedReleaseDate) ? null : parsedReleaseDate,
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
      externalKey: series.Id,
      // mediaItem,
      identifiers: collectJellyfinItemIdentifiers(
        series,
        this.options.mediaSourceUuid!,
      ),
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
      canonicalId: this.canonicalizer.getCanonicalId(season),
      title: season.Name!,
      // originalTitle: season.OriginalTitle ?? null,
      year: season.ProductionYear ?? null,
      releaseDate: isError(parsedReleaseDate) ? null : parsedReleaseDate,
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
      externalKey: season.Id,
      // mediaItem,
      identifiers: collectJellyfinItemIdentifiers(
        season,
        this.options.mediaSourceUuid!,
      ),
      index:
        season.IndexNumber ?? getSeasonNumberFromPath(season.Path ?? '') ?? 0,
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

    const people = getJellyfinItemPersonMap(episode);
    const parsedReleaseDate = isNonEmptyString(episode.PremiereDate)
      ? attemptSync(() => dayjs(episode.PremiereDate))
      : null;
    const mediaItem = this.jellyfinApiMediaSourcesInjection(
      episode,
      episode.MediaSources ?? [],
    );

    if (!mediaItem) {
      return null;
    }

    return {
      uuid: v4(),
      canonicalId: this.canonicalizer.getCanonicalId(episode),
      title: episode.Name!,
      originalTitle: episode.OriginalTitle ?? null,
      year: episode.ProductionYear ?? null,
      releaseDate: isError(parsedReleaseDate) ? null : parsedReleaseDate,
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
      summary: null,
      type: 'episode',
      externalKey: episode.Id,
      mediaItem,
      identifiers: collectJellyfinItemIdentifiers(
        episode,
        this.options.mediaSourceUuid!,
      ),
    };
  }

  private jellyfinApiMusicArtistInjection(artist: ApiJellyfinMusicArtist) {
    return {
      title: artist.Name ?? '',
      canonicalId: this.canonicalizer.getCanonicalId(artist),
      externalKey: artist.Id,
      genres:
        artist.Genres?.map((genre) => ({
          name: genre,
        })) ?? [],
      identifiers: collectJellyfinItemIdentifiers(
        artist,
        this.options.mediaSourceUuid!,
      ),
      plot: null,
      rating: null,
      sourceType: 'jellyfin',
      summary: null,
      tagline: null,
      tags: artist.Tags ?? [],
      type: 'artist',
      uuid: v4(),
      year: null,
    } satisfies JellyfinMusicArtist;
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

    return {
      uuid: v4(),
      canonicalId: this.canonicalizer.getCanonicalId(track),
      title: track.Name ?? '',
      actors: [],
      directors: [],
      externalKey: track.Id,
      genres: [],
      tags: track.Tags?.filter(isNonEmptyString) ?? [],
      year: track.ProductionYear ?? null,
      originalTitle: null,
      releaseDate: isNonEmptyString(track.PremiereDate)
        ? dayjs(track.PremiereDate)
        : null,
      identifiers: collectJellyfinItemIdentifiers(
        track,
        this.options.mediaSourceUuid!,
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
    } satisfies JellyfinMusicTrack;
  }
}

type JellyfinApiPersonType = 'Actor' | 'Writer' | 'Director';
type LowercasedPersonType = Lowercase<JellyfinApiPersonType>;
const LowercasePersonTypes = ['actor', 'writer', 'director'] as const;
type PersonMapping = Partial<
  Record<LowercasedPersonType, (NamedEntity & { role?: string })[]>
>;

function getJellyfinItemPersonMap(item: JellyfinItem): PersonMapping {
  const mapping: PersonMapping = {};
  forEach(
    groupBy(item.People, (p) => p.Type?.toLowerCase()),
    (people, key) => {
      switch (key) {
        case 'actor':
        case 'writer':
        case 'director': {
          mapping[key] = people.map((person) => ({
            name: person.Name,
            role: person.Role ?? undefined,
            externalId: person.Id,
          }));
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
  item: JellyfinItem,
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
    num = parseInt(match[1]);
    if (!isNull(num)) return num;
  }

  if (path.toLowerCase().includes('special')) {
    return 0;
  }

  return null;
}
