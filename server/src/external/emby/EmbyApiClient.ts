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

import type { AxiosRequestConfig } from 'axios';
import axios, { isAxiosError } from 'axios';
import {
  find,
  isBoolean,
  isEmpty,
  isNil,
  isNumber,
  mapValues,
  omitBy,
  union,
} from 'lodash-es';
import { type NonEmptyArray } from 'ts-essentials';
import { v4 } from 'uuid';
import { z } from 'zod';
import {
  BaseApiClient,
  isQueryError,
  type ApiClientOptions,
  type QueryErrorResult,
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

export type EmbyApiClientOptions = Omit<ApiClientOptions, 'type'> & {
  userId?: string;
};

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

export class EmbyApiClient extends BaseApiClient<EmbyApiClientOptions> {
  protected redacter = new EmbyRequestRedacter();

  constructor(options: EmbyApiClientOptions) {
    if (!options.uri.endsWith('/emby')) {
      options.uri += '/emby';
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

  static async findAdminUser(
    server: Omit<ApiClientOptions, 'apiKey' | 'type'>,
    apiKey: string,
  ) {
    try {
      const response = await axios.get(`${server.uri}/Users`, {
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

  async ping() {
    try {
      await this.doGet({
        url: '/System/Ping',
      });
      return true;
    } catch (e) {
      this.logger.error(e);
      return false;
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
    userId ??= this.options.userId;
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

    if (isQueryError(result)) {
      return result;
    }

    return this.makeSuccessResult(
      find(result.data.Items, (item) => item.Id === itemId),
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
    return `${this.options.uri}/Items/${id}/Images/Primary`;
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

  protected override preRequestValidate(
    req: AxiosRequestConfig,
  ): Maybe<QueryErrorResult> {
    if (isEmpty(this.options.accessToken)) {
      return this.makeErrorResult(
        'no_access_token',
        'No Plex token provided. Please use the SignIn method or provide a X-Plex-Token in the Plex constructor.',
      );
    }
    return super.preRequestValidate(req);
  }
}
