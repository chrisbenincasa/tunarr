import { EmbyRequestRedacter } from '@/external/emby/EmbyRequestRedacter.js';
import type { Maybe, Nilable } from '@/types/util.js';
import { isNonEmptyString } from '@/util/index.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import { getTunarrVersion } from '@/util/version.js';
import {
  EmbyAuthenticationResultSchema,
  EmbyLibraryItemsResponse,
  EmbyLibraryResponse,
  EmbySystemInfo,
  EmbyUserSchema,
  type EmbyItem,
  type EmbyItemField,
  type EmbyItemKind,
  type EmbyItemSortBy,
} from '@tunarr/types/emby';

import type { MediaSourceStatus } from '@tunarr/types/api';
import type { AxiosRequestConfig } from 'axios';
import axios, { isAxiosError } from 'axios';
import {
  find,
  isBoolean,
  isEmpty,
  isError,
  isNil,
  isNumber,
  mapValues,
  omitBy,
  union,
} from 'lodash-es';
import { type NonEmptyArray } from 'ts-essentials';
import { v4 } from 'uuid';
import { z } from 'zod/v4';
import {
  BaseApiClient,
  type ApiClientOptions,
  type QueryResult,
} from '../BaseApiClient.ts';

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
};

export class EmbyApiClient extends BaseApiClient<ApiClientOptions> {
  protected redacter = new EmbyRequestRedacter();

  constructor(options: ApiClientOptions) {
    if (!options.url.endsWith('/emby')) {
      options.url += '/emby';
    }

    super({
      ...options,
      extraHeaders: {
        ...options.extraHeaders,
        Accept: 'application/json',
        // Authorization: getEmbyAuthorization(options.accessToken, undefined),
        'X-Emby-Token': options.accessToken,
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
        LoggerFactory.root.error(error, 'Error retrieving Emby self user', {
          className: EmbyApiClient.name,
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
      LoggerFactory.root.error(e, 'Error retrieving Emby users', {
        className: EmbyApiClient.name,
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
    );
  }

  async getUserViews(userId?: string) {
    userId ??= this.options.userId ?? undefined;
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

  async getItem(
    itemId: string,
    extraFields: EmbyItemField[] = [],
  ): Promise<QueryResult<Maybe<EmbyItem>>> {
    const result = await this.getItems(
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

  async getItems(
    userId: Nilable<string>, // Not required if we are using an access token
    libraryId: Nilable<string>,
    itemTypes: Nilable<EmbyItemKind[]> = null,
    extraFields: EmbyItemField[] = [],
    pageParams: Nilable<{ offset: number; limit: number }> = null,
    extraParams: EmbyGetItemsQuery = {},
    sortBy: NonEmptyArray<EmbyItemSortBy> = ['SortName', 'ProductionYear'],
  ): Promise<QueryResult<EmbyLibraryItemsResponse>> {
    // const userId = userId ?? this.options.userId;
    // const endpoint = isNonEmptyString(userId) ? `/`
    return this.doTypeCheckedGet('/Items', EmbyLibraryItemsResponse, {
      params: omitBy(
        {
          userId: userId ?? this.options.userId,
          parentId: libraryId,
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
            artistType: extraParams.artistType?.join(','),
          },
        },
        (v) => isNil(v) || (!isNumber(v) && isEmpty(v)),
      ),
    });
  }

  getThumbUrl(id: string) {
    // Naive impl for now...
    return `${this.options.url}/Items/${id}/Images/Primary`;
  }

  getExternalUrl(id: string) {
    //TODO: This might need a server ID
    return `${this.options.url}/web/#/item?id=${id}`;
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
        userId: this.options.userId,
      },
      headers: {
        Authorization: getEmbyAuthorization(this.options.accessToken, deviceId),
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
        Authorization: getEmbyAuthorization(this.options.accessToken, deviceId),
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
      return this.makeErrorResult('no_access_token', 'No Emby token provided.');
    }
    return super.preRequestValidate(req);
  }
}
