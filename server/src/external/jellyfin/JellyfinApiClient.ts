import constants from '@tunarr/shared/constants';
import {
  JellyfinAuthenticationResult,
  JellyfinItemKind,
  JellyfinLibraryItemsResponse,
  JellyfinLibraryResponse,
  JellyfinSystemInfo,
} from '@tunarr/types/jellyfin';
import axios, { AxiosRequestConfig } from 'axios';
import { isEmpty, union } from 'lodash-es';
import { v4 } from 'uuid';
import { Maybe, Nilable } from '../../types/util';
import { LoggerFactory } from '../../util/logging/LoggerFactory';
import { BaseApiClient, QueryErrorResult } from '../BaseApiClient.js';

type RemoteMediaSourceOptions = {
  name?: string;
  uri: string;
  apiKey: string;
  type: 'plex' | 'jellyfin';
};

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
];

export class JellyfinApiClient extends BaseApiClient {
  constructor(private options: Omit<RemoteMediaSourceOptions, 'type'>) {
    super({
      name: options.name,
      url: options.uri,
      extraHeaders: {
        Accept: 'application/json',
        'X-Emby-Token': options.apiKey,
      },
    });
  }

  static async login(
    server: Omit<RemoteMediaSourceOptions, 'apiKey' | 'type'>,
    username: string,
    password: string,
  ) {
    try {
      const response = await axios.post(
        `${server.uri}/Users/AuthenticateByName`,
        {
          Username: username,
          Pw: password,
        },
        {
          headers: {
            Authorization: `MediaBrowser Client="Tunarr", Device="Web Browser", DeviceId=${v4()}, Version=${
              constants.VERSION_NAME
            }`,
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

  async getLibrary(
    userId: Nilable<string>, // Not required if we are using an access token
    libraryId: Nilable<string>,
    itemTypes: Nilable<JellyfinItemKind[]> = null,
    extraFields: string[] = [],
    pageParams: Nilable<{ offset: number; limit: number }> = null,
  ) {
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
      },
    });
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
