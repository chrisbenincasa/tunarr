import {
  JellyfinAuthenticationResult,
  JellyfinItem,
  JellyfinItemFields,
  JellyfinItemKind,
  JellyfinLibraryItemsResponse,
  JellyfinLibraryResponse,
  JellyfinSystemInfo,
  JellyfinUser,
} from '@tunarr/types/jellyfin';
import axios, {
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
  isAxiosError,
} from 'axios';
import { find, first, isEmpty, isObject, union } from 'lodash-es';
import { v4 } from 'uuid';
import { z } from 'zod';
import { Maybe, Nilable } from '../../types/util';
import { isNonEmptyString } from '../../util/index.js';
import { LoggerFactory } from '../../util/logging/LoggerFactory';
import { getTunarrVersion } from '../../util/version.js';
import {
  BaseApiClient,
  QueryErrorResult,
  QueryResult,
  RemoteMediaSourceOptions,
  isQueryError,
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
  parts.push('Device="Web Browser"', `Version="${getTunarrVersion()}"`);

  return `MediaBrowser ${parts.join(', ')}`;
}

export type JellyfinApiClientOptions = Omit<
  RemoteMediaSourceOptions,
  'type'
> & {
  userId?: string;
};

export class JellyfinApiClient extends BaseApiClient<JellyfinApiClientOptions> {
  constructor(options: JellyfinApiClientOptions) {
    super({
      ...options,
      extraHeaders: {
        ...options.extraHeaders,
        Accept: 'application/json',
        Authorization: getJellyfinAuthorization(options.apiKey, undefined),
      },
    });
  }

  static async findAdminUser(
    server: Omit<RemoteMediaSourceOptions, 'apiKey' | 'type'>,
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
    } catch (e) {
      LoggerFactory.root.error(e, 'Error retrieving Jellyfin users', {
        className: JellyfinApiClient.name,
      });
      return;
    }
  }

  static async login(
    server: Omit<RemoteMediaSourceOptions, 'apiKey' | 'type'>,
    username: string,
    password: string,
    clientId: string = v4(),
  ) {
    try {
      const response = await axios.post(
        `${server.url}/Users/AuthenticateByName`,
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
        this.redactRequestInfo(e.config);
      }
      LoggerFactory.root.error(
        { error: e as unknown, className: JellyfinApiClient.name },
        'Error logging into Jellyfin',
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
      return false;
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
        presetViews: ['movies', 'tvshows', 'music', 'playlists', 'folders'],
      },
    });
  }

  async getItem(
    itemId: string,
    extraFields: JellyfinItemFields[] = [],
  ): Promise<QueryResult<Maybe<JellyfinItem>>> {
    const result = await this.getItems(
      null,
      null,
      null,
      ['MediaStreams', 'MediaSources', ...extraFields],
      null,
      {
        ids: itemId,
      },
    );

    if (isQueryError(result)) {
      return result;
    }

    return this.makeSuccessResult(first(result.data.Items));
  }

  async getItems(
    userId: Nilable<string>, // Not required if we are using an access token
    libraryId: Nilable<string>,
    itemTypes: Nilable<JellyfinItemKind[]> = null,
    extraFields: JellyfinItemFields[] = [],
    pageParams: Nilable<{ offset: number; limit: number }> = null,
    extraParams: object = {},
  ): Promise<QueryResult<JellyfinLibraryItemsResponse>> {
    return this.doTypeCheckedGet('/Items', JellyfinLibraryItemsResponse, {
      params: {
        userId: userId ?? this.options.userId,
        parentId: libraryId,
        fields: union(extraFields, RequiredLibraryFields).join(','),
        startIndex: pageParams?.offset,
        limit: pageParams?.limit,
        // These will be configurable eventually
        sortOrder: 'Ascending',
        sortBy: 'SortName,ProductionYear',
        recursive: true,
        includeItemTypes: itemTypes ? itemTypes.join(',') : undefined,
        ...extraParams,
      },
    });
  }

  getThumbUrl(id: string) {
    // Naive impl for now...
    return `${this.options.url}/Items/${id}/Images/Primary`;
  }

  async recordPlaybackStart(itemId: string, deviceId: string) {
    return this.doPost({
      url: '/Sessions/Playing',
      params: {
        userId: this.options.userId,
      },
      headers: {
        Authorization: getJellyfinAuthorization(this.options.apiKey, deviceId),
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
        Authorization: getJellyfinAuthorization(this.options.apiKey, deviceId),
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
    if (isEmpty(this.options.apiKey)) {
      return this.makeErrorResult(
        'no_access_token',
        'No Plex token provided. Please use the SignIn method or provide a X-Plex-Token in the Plex constructor.',
      );
    }
    return super.preRequestValidate(req);
  }

  protected static override redactRequestInfo(
    conf: InternalAxiosRequestConfig<unknown>,
  ): void {
    super.redactRequestInfo(conf);
    if (conf.url?.includes('/AuthenticateByName')) {
      conf.data = '<REDACTED>';
    }

    if (conf.headers) {
      if (conf.headers['X-Emby-Token']) {
        conf.headers['X-Emby-Token'] = '<REDACTED>';
      }
    }

    if (conf.params && isObject(conf.params)) {
      if (conf.params['X-Emby-Token']) {
        conf.headers['X-Emby-Token'] = '<REDACTED>';
      }
    }
  }
}
