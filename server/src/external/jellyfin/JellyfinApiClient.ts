import { JellyfinRequestRedacter } from '@/external/jellyfin/JellyfinRequestRedacter.js';
import type { Maybe, Nilable } from '@/types/util.js';
import { caughtErrorToError, isNonEmptyString } from '@/util/index.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import { getTunarrVersion } from '@/util/version.js';
import type { MediaSourceStatus } from '@tunarr/types/api';
import type {
  JellyfinItem,
  JellyfinItemFields,
  JellyfinItemKind,
  JellyfinItemSortBy,
} from '@tunarr/types/jellyfin';
import {
  JellyfinAuthenticationResult,
  JellyfinLibraryItemsResponse,
  JellyfinSystemInfo,
  JellyfinVirtualFolderResponse,
} from '@tunarr/types/jellyfin';
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
import { v4 } from 'uuid';
import {
  type ApiClientOptions,
  BaseApiClient,
  isQueryError,
  type QueryErrorResult,
  type QueryResult,
} from '../BaseApiClient.js';

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

export class JellyfinApiClient extends BaseApiClient {
  protected redacter = new JellyfinRequestRedacter();

  constructor(options: ApiClientOptions) {
    super({
      ...options,
      extraHeaders: {
        ...options.extraHeaders,
        Accept: 'application/json',
        Authorization: getJellyfinAuthorization(options.accessToken, undefined),
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
            userId: this.options.userId,
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

  async getUserLibraries() {
    return this.doTypeCheckedGet(
      '/Library/VirtualFolders',
      JellyfinVirtualFolderResponse,
    );
  }

  async getUserViews() {
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

  async getItem(
    itemId: string,
    extraFields: JellyfinItemFields[] = [],
  ): Promise<QueryResult<Maybe<JellyfinItem>>> {
    const result = await this.getItems(
      null,
      null,
      ['MediaStreams', 'MediaSources', ...extraFields],
      { offset: 0, limit: 1 },
      {
        ids: [itemId],
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
          userId: this.options.userId,
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

  getThumbUrl(id: string) {
    // Naive impl for now...
    return `${this.options.url}/Items/${id}/Images/Primary`;
  }

  getExternalUrl(id: string) {
    return `${this.options.url}/web/#/details?id=${id}`;
  }

  async getGenres(
    parentId?: string,
    includeItemTypes?: string,
  ): Promise<QueryResult<JellyfinLibraryItemsResponse>> {
    try {
      return this.doTypeCheckedGet('/Genres', JellyfinLibraryItemsResponse, {
        params: {
          parentId,
          userId: this.options.userId,
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

  protected override preRequestValidate(
    req: AxiosRequestConfig,
  ): Maybe<QueryErrorResult> {
    if (isEmpty(this.options.accessToken)) {
      return this.makeErrorResult(
        'no_access_token',
        'No Jellyfin token provided.',
      );
    }
    return super.preRequestValidate(req);
  }
}
