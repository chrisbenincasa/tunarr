import axios, { AxiosInstance } from 'axios';
import { Logger, LoggerFactory } from '../../util/logging/LoggerFactory';
import { configureAxiosLogging } from '../../util/axios';
import {
  JellyfinLibraryItemsResponse,
  JellyfinLibraryResponse,
} from '@tunarr/types/jellyfin';
import { union } from 'lodash-es';
import { Nilable } from '../../types/util';

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

export class JellyfinApiClient {
  private logger: Logger;
  private axiosInstance: AxiosInstance;

  constructor(options: RemoteMediaSourceOptions) {
    this.logger = LoggerFactory.child({
      className: JellyfinApiClient.name,
      serverName: options.name,
    });

    const uri = options.uri.endsWith('/')
      ? options.uri.slice(0, options.uri.length - 1)
      : options.uri;

    this.axiosInstance = axios.create({
      baseURL: uri,
      headers: {
        Accept: 'application/json',
        'X-Emby-Token': options.apiKey,
      },
    });

    configureAxiosLogging(this.axiosInstance, this.logger);
  }

  async getUserLibraries(userId: string) {
    const response = await this.axiosInstance.request({
      method: 'get',
      url: '/Library/VirtualFolders',
      params: {
        userId,
      },
    });

    return await JellyfinLibraryResponse.parseAsync(response.data);
  }

  async getLibrary(
    userId: Nilable<string>, // Not required if we are using an access token
    libraryId: Nilable<string>,
    extraFields: string[] = [],
    pageParams: Nilable<{ offset: number; limit: number }> = null,
  ) {
    const allFields = union(extraFields, RequiredLibraryFields);
    const response = await this.axiosInstance.request({
      method: 'get',
      url: '/Items',
      params: {
        userId,
        parentId: libraryId,
        fields: allFields.join(','),
        startIndex: pageParams?.offset,
        limit: pageParams?.limit,
        // These will be configurable eventually
        sortOrder: 'Ascending',
        sortBy: 'SortName',
      },
    });

    return await JellyfinLibraryItemsResponse.parseAsync(response.data);
  }
}
