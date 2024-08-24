import {
  JellyfinAuthenticationResult,
  JellyfinItem,
  JellyfinItemFields,
  JellyfinItemKind,
  JellyfinLibraryItemsResponse,
  JellyfinLibraryResponse,
  JellyfinSystemInfo,
} from '@tunarr/types/jellyfin';
import axios, { AxiosRequestConfig } from 'axios';
import { first, isEmpty, union } from 'lodash-es';
import { v4 } from 'uuid';
import { Maybe, Nilable } from '../../types/util';
import { LoggerFactory } from '../../util/logging/LoggerFactory';
import {
  BaseApiClient,
  QueryErrorResult,
  QueryResult,
  RemoteMediaSourceOptions,
  isQueryError,
} from '../BaseApiClient.js';
import { getTunarrVersion } from '../../util/version.js';

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
];

export class JellyfinApiClient extends BaseApiClient<
  Omit<RemoteMediaSourceOptions, 'type'>
> {
  constructor(options: Omit<RemoteMediaSourceOptions, 'type'>) {
    super({
      ...options,
      extraHeaders: {
        ...options.extraHeaders,
        Accept: 'application/json',
        'X-Emby-Token': options.apiKey,
      },
    });
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
            Authorization: `MediaBrowser Client="Tunarr", Device="Web Browser", DeviceId=${clientId}, Version=${getTunarrVersion()}`,
          },
        },
      );

      return await JellyfinAuthenticationResult.parseAsync(response.data);
    } catch (e) {
      LoggerFactory.root.error(e, 'Error logging into Jellyfin', {
        className: JellyfinApiClient.name,
      });
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
        userId,
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
      ['MediaStreams', ...extraFields],
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
        userId,
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
      headers: {
        Authorization: `MediaBrowser Client="Tunarr", Device="Web Browser", DeviceId=${deviceId}, Version=${getTunarrVersion()}`,
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
      headers: {
        Authorization: `MediaBrowser Client="Tunarr", Device="Web Browser", DeviceId=${deviceId}, Version=${getTunarrVersion()}`,
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
}
