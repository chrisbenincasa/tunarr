import type { Nilable } from '@/types/util.js';
import { type Maybe } from '@/types/util.js';
import { getChannelId } from '@/util/channels.js';
import {
  caughtErrorToError,
  isDefined,
  isNonEmptyString,
} from '@/util/index.js';
import { getTunarrVersion } from '@/util/version.js';
import { PlexClientIdentifier } from '@tunarr/shared/constants';
import { seq } from '@tunarr/shared/util';
import type { MediaSourceStatus } from '@tunarr/types/api';
import type {
  PlexEpisode as ApiPlexEpisode,
  PlexMovie as ApiPlexMovie,
  PlexMusicAlbum as ApiPlexMusicAlbum,
  PlexMusicArtist as ApiPlexMusicArtist,
  PlexMusicTrack as ApiPlexMusicTrack,
  PlexTvSeason as ApiPlexTvSeason,
  PlexTvShow as ApiPlexTvShow,
  PlexJoinItem,
  PlexMediaAudioStream,
  PlexMediaContainerMetadata,
  PlexMediaContainerResponse,
  PlexMediaDescription,
  PlexMediaVideoStream,
  PlexTerminalMedia,
} from '@tunarr/types/plex';
import {
  MakePlexMediaContainerResponseSchema,
  PlexContainerStatsSchema,
  type PlexDvr,
  type PlexDvrsResponse,
  PlexEpisodeSchema,
  PlexGenericMediaContainerResponseSchema,
  PlexLibrariesResponseSchema,
  PlexLibraryCollectionSchema,
  type PlexMedia,
  PlexMediaContainerResponseSchema,
  type PlexMetadataResponse,
  PlexMovieMediaContainerResponseSchema,
  PlexMusicAlbumSchema,
  PlexMusicArtistSchema,
  PlexMusicTrackSchema,
  PlexPlaylistSchema,
  type PlexResource,
  PlexTvSeasonSchema,
  PlexTvShowSchema,
  PlexUserSchema,
} from '@tunarr/types/plex';
import {
  type AxiosRequestConfig,
  type RawAxiosRequestHeaders,
  isAxiosError,
} from 'axios';
import dayjs from 'dayjs';
import { XMLParser } from 'fast-xml-parser';
import {
  filter,
  find,
  first,
  flatMap,
  forEach,
  isEmpty,
  isError,
  isNil,
  isUndefined,
  map,
  maxBy,
  reject,
  sortBy,
} from 'lodash-es';
import { match } from 'ts-pattern';
import { v4 } from 'uuid';
import type { z } from 'zod/v4';
import type { PageParams } from '../../db/interfaces/IChannelDB.ts';
import { MediaSourceType } from '../../db/schema/MediaSource.ts';
import { ProgramType } from '../../db/schema/Program.js';
import { ProgramGroupingType } from '../../db/schema/ProgramGrouping.js';
import type { Canonicalizer } from '../../services/Canonicalizer.ts';
import type { WrappedError } from '../../types/errors.ts';
import type {
  MediaItem,
  MediaStream,
  NamedEntity,
  PlexAlbum,
  PlexArtist,
  PlexEpisode,
  PlexMovie,
  PlexSeason,
  PlexShow,
  PlexTrack,
} from '../../types/Media.js';
import { Result } from '../../types/result.ts';
import { parsePlexGuid } from '../../util/externalIds.ts';
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
  private opts: ApiClientOptions;

  constructor(
    private canonicalizer: Canonicalizer<PlexMedia>,
    opts: ApiClientOptions,
  ) {
    super({
      ...opts,
      extraHeaders: {
        ...PlexHeaders,
        'X-Plex-Version': getTunarrVersion(),
        'X-Plex-Token': opts.accessToken,
      },
      queueOpts: {
        concurrency: 5,
        interval: dayjs.duration({ seconds: 1 }),
      },
    });
    this.opts = opts;
  }

  get serverName() {
    return this.opts.name;
  }

  get serverId() {
    return this.opts.mediaSourceUuid;
  }

  getFullUrl(path: string): string {
    const url = super.getFullUrl(path);
    const parsed = new URL(url);
    parsed.searchParams.set('X-Plex-Token', this.opts.accessToken);
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

      if (this.opts.accessToken === '') {
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

    return this.opts.enableRequestCache && !skipCache
      ? await PlexCache.getOrSetPlexResult<T>(this.opts.name, path, getter)
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

  getMovieLibraryContents(
    libraryId: string,
    pageSize: number = 50,
  ): AsyncIterable<PlexMovie> {
    return this.getLibraryContents(
      libraryId,
      PlexMovieMediaContainerResponseSchema,
      (movie) => this.plexMovieInjection(movie, this.opts.mediaSourceUuid!),
      pageSize,
    );
  }

  getTvShowLibraryContents(
    libraryId: string,
    pageSize: number = 50,
  ): AsyncGenerator<PlexShow> {
    return this.getLibraryContents(
      libraryId,
      MakePlexMediaContainerResponseSchema(PlexTvShowSchema),
      (show) =>
        Result.success(
          this.plexShowInjection(show, this.opts.mediaSourceUuid!),
        ),
      pageSize,
    );
  }

  getTvShowSeasons(tvShowKey: string, pageSize: number = 50) {
    return this.getLibraryContents(
      tvShowKey,
      MakePlexMediaContainerResponseSchema(PlexTvSeasonSchema),
      (season) =>
        Result.success(
          this.plexSeasonInjection(season, this.opts.mediaSourceUuid!),
        ),
      pageSize,
      `/library/metadata/${tvShowKey}/children`,
    );
  }

  getEpisodes(
    tvSeasonKey: string,
    pageSize: number = 50,
  ): AsyncIterable<PlexEpisode> {
    return this.getLibraryContents(
      tvSeasonKey,
      MakePlexMediaContainerResponseSchema(PlexEpisodeSchema),
      (ep) => this.plexEpisodeInjection(ep, this.opts.mediaSourceUuid!),
      pageSize,
      `/library/metadata/${tvSeasonKey}/children`,
    );
  }

  getMusicLibraryContents(
    libraryId: string,
    pageSize: number = 50,
  ): AsyncIterable<PlexArtist> {
    return this.getLibraryContents(
      libraryId,
      MakePlexMediaContainerResponseSchema(PlexMusicArtistSchema),
      (artist) =>
        Result.success(
          this.plexMusicArtistInjection(artist, this.opts.mediaSourceUuid!),
        ),
      pageSize,
    );
  }

  getArtistAlbums(
    artistKey: string,
    pageSize: number = 50,
  ): AsyncIterable<PlexAlbum> {
    return this.getLibraryContents(
      artistKey,
      MakePlexMediaContainerResponseSchema(PlexMusicAlbumSchema),
      (album) =>
        Result.success(
          this.plexAlbumInjection(album, this.opts.mediaSourceUuid!),
        ),
      pageSize,
      `/library/metadata/${artistKey}/children`,
    );
  }

  getAlbumTracks(
    albumKey: string,
    pageSize: number = 50,
  ): AsyncIterable<PlexTrack> {
    return this.getLibraryContents(
      albumKey,
      MakePlexMediaContainerResponseSchema(PlexMusicTrackSchema),
      (track) => this.plexTrackInjection(track, this.opts.mediaSourceUuid!),
      pageSize,
      `/library/metadata/${albumKey}/children`,
    );
  }

  async getMusicTrack(key: string): Promise<QueryResult<PlexTrack>> {
    const queryResult = await this.getItemMetadataInternal(
      key,
      MakePlexMediaContainerResponseSchema(PlexMusicTrackSchema),
    );

    return queryResult.flatMap((track) =>
      this.plexTrackInjection(track, this.opts.mediaSourceUuid!).mapError((e) =>
        QueryError.genericQueryError(e.message),
      ),
    );
  }

  private async *getLibraryContents<OutType, ItemType extends PlexMedia>(
    libraryId: string,
    schema: z.ZodType<PlexMetadataResponse<ItemType>>,
    converter: (item: ItemType) => Result<OutType>,
    pageSize: number = 50,
    key: string = `/library/sections/${libraryId}/all`,
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

      for (const item of chunkResult.get().MediaContainer.Metadata ?? []) {
        const converted = converter(item);
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

  async getLibraries() {
    return this.doTypeCheckedGet(
      '/library/sections',
      PlexLibrariesResponseSchema,
    );
  }

  async getLibraryCollections(libraryId: string, paging?: PageParams) {
    const pageParams = paging
      ? {
          'X-Plex-Container-Start': paging.offset,
          'X-Plex-Container-Size': paging.limit,
        }
      : {};
    return this.doTypeCheckedGet(
      `/library/sections/${libraryId}/collections`,
      MakePlexMediaContainerResponseSchema(PlexLibraryCollectionSchema),
      {
        params: {
          ...pageParams,
        },
      },
    );
  }

  async getLibraryCount(libraryId: string) {
    return this.getChildCount(`/library/sections/${libraryId}/all`);
  }

  async getItemChildCount(key: string) {
    return this.getChildCount(`/library/metadata/${key}/children`);
  }

  async getPlaylists(libraryId?: string, paging?: PageParams) {
    const params = {};

    if (paging) {
      params['X-Plex-Container-Start'] = paging.offset;
      params['X-Plex-Container-Size'] = paging.limit;
    }

    if (libraryId) {
      params['sectionID'] = libraryId;
      params['type'] = '15';
    }

    return this.doTypeCheckedGet(
      '/playlists',
      MakePlexMediaContainerResponseSchema(PlexPlaylistSchema),
      {
        params,
      },
    );
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

  async getMovieMetadata(key: string): Promise<Result<PlexMovie>> {
    return this.getItemMetadataInternal(
      key,
      PlexMovieMediaContainerResponseSchema,
    ).then((result) =>
      result.flatMap((m) =>
        this.plexMovieInjection(m, this.opts.mediaSourceUuid!),
      ),
    );
  }

  async getTvShowMetadata(externalKey: string): Promise<QueryResult<PlexShow>> {
    const queryResult = await this.getItemMetadataInternal(
      externalKey,
      MakePlexMediaContainerResponseSchema(PlexTvShowSchema),
    );
    return queryResult.mapPure((show) =>
      this.plexShowInjection(show, this.opts.mediaSourceUuid!),
    );
  }

  async getSeasonMetadata(key: string): Promise<QueryResult<ApiPlexTvSeason>> {
    return this.getItemMetadataInternal(
      key,
      MakePlexMediaContainerResponseSchema(PlexTvSeasonSchema),
    );
  }

  async getEpisodeMetadata(key: string): Promise<Result<PlexEpisode>> {
    return this.getItemMetadataInternal(
      key,
      MakePlexMediaContainerResponseSchema(PlexEpisodeSchema),
    ).then((_) =>
      _.flatMap((ep) =>
        this.plexEpisodeInjection(ep, this.opts.mediaSourceUuid!),
      ),
    );
  }

  async getItemChildren(
    key: string,
    itemType: 'item' | 'collection' | 'playlist',
  ) {
    const path = match(itemType)
      .with('collection', () => `/library/collections/${key}/children`)
      .with('playlist', () => `/playlists/${key}/items`)
      .with('item', () => `/library/metadata/${key}/children`)
      .exhaustive();

    return this.doTypeCheckedGet(path, PlexMediaContainerResponseSchema);
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

  async refreshChannels(
    channels: { number: number; stealth: number; uuid: string }[],
    providedDvrs?: PlexDvr[],
  ) {
    const liveChannels = reject(channels, { stealth: 1 });
    const dvrs = !isEmpty(providedDvrs) ? providedDvrs : await this.getDvrs();
    if (!dvrs) {
      throw new Error('Could not retrieve Plex DVRs');
    }

    if (isEmpty(dvrs)) {
      return;
    }

    const qs: Record<string, number | string> = {
      channelsEnabled: map(liveChannels, 'number').join(','),
    };

    forEach(channels, ({ number }) => {
      const id = getChannelId(number);
      qs[`channelMapping[${number}]`] = number;
      qs[`channelMappingByKey[${number}]`] = id;
    });

    const keys = map(
      flatMap(dvrs, ({ Device }) => Device),
      (device) => device.key,
    );

    for (const key of keys) {
      await this.doPut({
        url: `/media/grabbers/devices/${key}/channelmap`,
        params: qs,
      });
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
      uri: this.opts.url,
      accessToken: this.opts.accessToken,
      itemKey: opts.itemKey,
      width: opts.width,
      height: opts.height,
      upscale: opts.upscale,
      imageType: opts.imageType,
    });
  }

  setEnableRequestCache(enable: boolean) {
    this.opts.enableRequestCache = enable;
  }

  protected override preRequestValidate<T>(
    req: AxiosRequestConfig,
  ): Maybe<QueryResult<T>> {
    if (isEmpty(this.opts.accessToken)) {
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
    mediaSourceId: string,
  ): PlexShow {
    return {
      uuid: v4(),
      canonicalId: this.canonicalizer.getCanonicalId(plexShow),
      sourceType: MediaSourceType.Plex,
      externalKey: plexShow.ratingKey,
      title: plexShow.title,
      type: ProgramGroupingType.Show,
      year: plexShow.year ?? null,
      releaseDate: plexShow.originallyAvailableAt
        ? Result.attempt(() => dayjs(plexShow.originallyAvailableAt)).orNull()
        : null,
      actors: [],
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
          sourceId: mediaSourceId,
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
    } satisfies PlexShow;
  }

  private plexSeasonInjection(
    plexSeason: ApiPlexTvSeason,
    mediaSourceId: string,
  ): PlexSeason {
    return {
      uuid: v4(),
      canonicalId: this.canonicalizer.getCanonicalId(plexSeason),
      sourceType: MediaSourceType.Plex,
      externalKey: plexSeason.ratingKey,
      title: plexSeason.title,
      type: ProgramGroupingType.Season,
      index: plexSeason.index,
      releaseDate: null,
      // year: plexSeason.year ?? null,
      //  actors: [],
      //  genres: plexJoinItemInject(plexSeason.Genre),
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
          sourceId: mediaSourceId,
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
    } satisfies PlexSeason;
  }

  private plexEpisodeInjection(
    plexEpisode: ApiPlexEpisode,
    mediaSourceId: string,
  ): Result<PlexEpisode> {
    if (isNil(plexEpisode.duration) || plexEpisode.duration <= 0) {
      return Result.forError(
        new Error(
          `Plex movie ID = ${plexEpisode.ratingKey} has invalid duration.`,
        ),
      );
    }

    if (isNil(plexEpisode.Media) || isEmpty(plexEpisode.Media)) {
      return Result.forError(
        new Error(
          `Plex movie ID = ${plexEpisode.ratingKey} has no Media streams`,
        ),
      );
    }

    const actors =
      plexEpisode.Role?.map(({ tag, role }) => ({ name: tag, role })) ?? [];
    const directors =
      plexEpisode.Director?.map(({ tag }) => ({ name: tag })) ?? [];
    const writers = plexEpisode.Writer?.map(({ tag }) => ({ name: tag })) ?? [];

    const episode: PlexEpisode = {
      uuid: v4(),
      canonicalId: this.canonicalizer.getCanonicalId(plexEpisode),
      type: ProgramType.Episode,
      sourceType: MediaSourceType.Plex,
      externalKey: plexEpisode.ratingKey,
      title: plexEpisode.title,
      originalTitle: null,
      year: null,
      summary: plexEpisode.summary ?? null,
      actors,
      directors,
      writers,
      episodeNumber: plexEpisode.index ?? 0,
      mediaItem: plexMediaStreamsInject(
        plexEpisode.ratingKey,
        plexEpisode.Media,
      ).getOrElse(() => emptyMediaItem(plexEpisode)),
      genres: [],
      releaseDate: plexEpisode.originallyAvailableAt
        ? dayjs(plexEpisode.originallyAvailableAt)
        : null,
      studios: [],
      identifiers: [
        {
          id: plexEpisode.ratingKey,
          type: 'plex',
          sourceId: mediaSourceId,
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
    };

    return Result.success(episode);
  }

  private plexMovieInjection(
    plexMovie: ApiPlexMovie,
    mediaSourceId: string,
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

    const actors =
      plexMovie.Role?.map(({ tag, role }) => ({ name: tag, role })) ?? [];
    const directors =
      plexMovie.Director?.map(({ tag }) => ({ name: tag })) ?? [];
    const writers = plexMovie.Writer?.map(({ tag }) => ({ name: tag })) ?? [];
    const studios = isNonEmptyString(plexMovie.studio)
      ? [{ name: plexMovie.studio }]
      : [];

    return Result.success({
      uuid: v4(),
      type: ProgramType.Movie,
      canonicalId: this.canonicalizer.getCanonicalId(plexMovie),
      sourceType: MediaSourceType.Plex,
      externalKey: plexMovie.ratingKey,
      title: plexMovie.title,
      originalTitle: null,
      year: plexMovie.year ?? null,
      releaseDate: plexMovie.originallyAvailableAt
        ? dayjs(plexMovie.originallyAvailableAt)
        : null,
      mediaItem: plexMediaStreamsInject(
        plexMovie.ratingKey,
        plexMovie.Media,
      ).getOrElse(() => emptyMediaItem(plexMovie)),
      actors,
      directors,
      writers,
      studios,
      genres: plexMovie.Genre?.map(({ tag }) => ({ name: tag })) ?? [],
      summary: plexMovie.summary ?? null,
      plot: null,
      tagline: plexMovie.tagline ?? null,
      rating: plexMovie.contentRating ?? null,
      tags: [],
      identifiers: [
        {
          id: plexMovie.ratingKey,
          type: 'plex',
          sourceId: mediaSourceId,
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
    });
  }

  private plexMusicArtistInjection(
    plexArtist: ApiPlexMusicArtist,
    mediaSourceId: string,
  ) {
    return {
      uuid: v4(),
      canonicalId: this.canonicalizer.getCanonicalId(plexArtist),
      sourceType: MediaSourceType.Plex,
      externalKey: plexArtist.ratingKey,
      title: plexArtist.title,
      type: ProgramGroupingType.Artist,
      year: null,
      rating: null,
      tagline: null,
      // releaseDate: plexArtist.originallyAvailableAt
      //   ? Result.attempt(() => dayjs(plexArtist.originallyAvailableAt)).orNull()
      //   : null,
      // actors: [],
      genres: plexJoinItemInject(plexArtist.Genre),
      plot: null,
      // studios: isNonEmptyString(plexArtist.studio)
      //   ? [{ name: plexArtist.studio }]
      //   : [],
      // rating: plexArtist.contentRating ?? null,
      summary: plexArtist.summary ?? null,
      // tagline: plexArtist.tagline ?? null,
      identifiers: [
        {
          type: 'plex',
          id: plexArtist.ratingKey,
          sourceId: mediaSourceId,
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
    } satisfies PlexArtist;
  }

  private plexAlbumInjection(
    plexAlbum: ApiPlexMusicAlbum,
    mediaSourceId: string,
  ): PlexAlbum {
    return {
      uuid: v4(),
      canonicalId: this.canonicalizer.getCanonicalId(plexAlbum),
      sourceType: MediaSourceType.Plex,
      externalKey: plexAlbum.ratingKey,
      title: plexAlbum.title,
      type: ProgramGroupingType.Album,
      index: plexAlbum.index,
      releaseDate: null,
      // year: plexSeason.year ?? null,
      //  actors: [],
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
          sourceId: mediaSourceId,
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
    };
  }

  private plexTrackInjection(
    plexTrack: ApiPlexMusicTrack,
    mediaSourceId: string,
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

    const episode: PlexTrack = {
      uuid: v4(),
      canonicalId: this.canonicalizer.getCanonicalId(plexTrack),
      type: ProgramType.Track,
      sourceType: MediaSourceType.Plex,
      externalKey: plexTrack.ratingKey,
      title: plexTrack.title,
      originalTitle: null,
      year: plexTrack.parentYear ?? null,
      // summary:null,
      actors: [],
      directors: [],
      writers: [],
      genres: [],
      trackNumber: plexTrack.index ?? 0,
      mediaItem: plexMediaStreamsInject(
        plexTrack.ratingKey,
        plexTrack.Media,
      ).getOrElse(() => emptyMediaItem(plexTrack)),
      // TODO:
      // genres: plexJoinItemInject(plexTrack.Genre),
      releaseDate: null,
      studios: [],
      identifiers: [
        {
          id: plexTrack.ratingKey,
          type: 'plex',
          sourceId: mediaSourceId,
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
    };

    return Result.success(episode);
  }
}

type PlexTvDevicesResponse = {
  MediaContainer: { Device: PlexResource[] };
};

function plexJoinItemInject(items: Nilable<PlexJoinItem[]>): NamedEntity[] {
  return items?.map(({ tag }) => ({ name: tag })) ?? [];
}

function emptyMediaItem(item: PlexTerminalMedia): MediaItem {
  const media = maxBy(
    item.Media?.filter((m) => (m.Part?.length ?? 0) > 0),
    (m) => m.id,
  )!;
  const part = media.Part[0];

  return {
    displayAspectRatio: '',
    duration: dayjs.duration(part.duration!),
    sampleAspectRatio: '',
    streams: [],
    resolution: { widthPx: media.width!, heightPx: media.height! },
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
  plexMedia: Maybe<PlexMediaDescription[]>,
  requireVideoStream: boolean = true,
): Result<MediaItem> {
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

  if (!relevantMediaPart || !apiMediaStreams) {
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
      // bitrate: videoStream.bitrate,
      profile: videoStream.profile?.toLowerCase() ?? '',
      index: videoStream.index,
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

  return Result.success({
    // Handle if this is not present...
    duration: dayjs.duration(relevantMedia.duration!),
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
  });
}
