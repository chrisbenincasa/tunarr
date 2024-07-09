import { EntityDTO } from '@mikro-orm/core';
import {
  PlexDvr,
  PlexDvrsResponse,
  PlexGenericMediaContainerResponseSchema,
  PlexMedia,
  PlexMediaContainerResponseSchema,
  PlexResource,
} from '@tunarr/types/plex';
import {
  AxiosRequestConfig,
  RawAxiosRequestHeaders,
  isAxiosError,
} from 'axios';
import { XMLParser } from 'fast-xml-parser';
import {
  first,
  flatMap,
  forEach,
  isEmpty,
  isError,
  isUndefined,
  map,
} from 'lodash-es';
import { MarkOptional } from 'ts-essentials';
import { MediaSource } from '../../dao/entities/MediaSource.js';
import {
  PlexMediaContainer,
  PlexMediaContainerResponse,
} from '../../types/plexApiTypes.js';
import { Maybe } from '../../types/util.js';
import { isSuccess } from '../../util/index.js';
import {
  BaseApiClient,
  QueryErrorResult,
  QueryResult,
  isQueryError,
  isQuerySuccess,
} from '../BaseApiClient.js';
import { PlexQueryCache } from './PlexQueryCache.js';

export type PlexApiOptions = MarkOptional<
  Pick<
    EntityDTO<MediaSource>,
    'accessToken' | 'uri' | 'name' | 'clientIdentifier'
  >,
  'clientIdentifier'
> & {
  enableRequestCache?: boolean;
};

const PlexCache = new PlexQueryCache();

export class PlexApiClient extends BaseApiClient {
  private opts: PlexApiOptions;
  private accessToken: string;

  constructor(opts: PlexApiOptions) {
    super({
      url: opts.uri,
      name: opts.name,
      extraHeaders: {
        'X-Plex-Token': opts.accessToken,
      },
    });
    this.opts = opts;
    this.accessToken = opts.accessToken;
  }

  get serverName() {
    return this.opts.name;
  }

  getFullUrl(path: string): string {
    const url = super.getFullUrl(path);
    const parsed = new URL(url);
    parsed.searchParams.set('X-Plex-Token', this.opts.accessToken);
    return parsed.toString();
  }

  // TODO: make all callers use this
  private async doGetResult<T>(
    path: string,
    optionalHeaders: RawAxiosRequestHeaders = {},
    skipCache: boolean = false,
  ): Promise<QueryResult<PlexMediaContainer<T>>> {
    const getter = async () => {
      const req: AxiosRequestConfig = {
        method: 'get',
        url: path,
        headers: optionalHeaders,
      };

      if (this.accessToken === '') {
        throw new Error(
          'No Plex token provided. Please use the SignIn method or provide a X-Plex-Token in the Plex constructor.',
        );
      }

      const res = await this.doRequest<PlexMediaContainerResponse<T>>(req);
      if (isSuccess(res)) {
        if (isUndefined(res?.MediaContainer)) {
          this.logger.error(res, 'Expected MediaContainer, got %O', res);
          return this.makeErrorResult('parse_error');
        }

        return this.makeSuccessResult(res?.MediaContainer);
      }

      if (isAxiosError(res) && res.response?.status === 404) {
        return this.makeErrorResult('not_found');
      }

      return this.makeErrorResult('generic_request_error', res.message);
    };

    return this.opts.enableRequestCache && !skipCache
      ? await PlexCache.getOrSetPlexResult(this.opts.name, path, getter)
      : await getter();
  }

  // We're just keeping the old contract here right now...
  async doGetPath<T>(
    path: string,
    optionalHeaders: RawAxiosRequestHeaders = {},
    skipCache: boolean = false,
  ): Promise<Maybe<PlexMediaContainer<T>>> {
    const result = await this.doGetResult<PlexMediaContainer<T>>(
      path,
      optionalHeaders,
      skipCache,
    );
    if (isQuerySuccess(result)) {
      return result.data;
    } else {
      return;
    }
  }

  async getItemMetadata(key: string): Promise<QueryResult<PlexMedia>> {
    const parsedResponse = await this.doTypeCheckedGet(
      `/library/metadata/${key}`,
      PlexMediaContainerResponseSchema,
    );

    if (isQuerySuccess(parsedResponse)) {
      const media = first(parsedResponse.data.MediaContainer.Metadata);
      if (!isUndefined(media)) {
        return this.makeSuccessResult(media);
      }
      this.logger.error(
        'Could not extract Metadata object for Plex media, key = %s',
        key,
      );
      return this.makeErrorResult('parse_error');
    }

    return parsedResponse;
  }

  async checkServerStatus() {
    try {
      const result = await this.doTypeCheckedGet(
        '/',
        PlexGenericMediaContainerResponseSchema,
      );
      if (isQueryError(result)) {
        throw result;
      } else if (isUndefined(result)) {
        // Parse error - indicates that the URL is probably not a Plex server
        return false;
      }
      return true;
    } catch (err) {
      this.logger.error(err, 'Error getting Plex server status');
      return false;
    }
  }

  async getDvrs() {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await this.doGetPath<PlexDvrsResponse>('/livetv/dvrs');
      return isUndefined(result?.Dvr) ? [] : result?.Dvr;
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

  async refreshChannels(channels: { number: number }[], _dvrs?: PlexDvr[]) {
    const dvrs = !isUndefined(_dvrs) ? _dvrs : await this.getDvrs();
    if (!dvrs) throw new Error('Could not retrieve Plex DVRs');

    const qs: Record<string, number | string> = {
      channelsEnabled: map(channels, 'number').join(','),
    };

    forEach(channels, ({ number }) => {
      qs[`channelMapping[${number}]`] = number;
      qs[`channelMappingByKey[${number}]`] = number;
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
  }) {
    return PlexApiClient.getThumbUrl({
      uri: this.opts.uri,
      accessToken: this.opts.accessToken,
      itemKey: opts.itemKey,
      width: opts.width,
      height: opts.height,
      upscale: opts.upscale,
    });
  }

  setEnableRequestCache(enable: boolean) {
    this.opts.enableRequestCache = enable;
  }

  protected override preRequestValidate(
    req: AxiosRequestConfig,
  ): Maybe<QueryErrorResult> {
    if (isEmpty(this.accessToken)) {
      return this.makeErrorResult(
        'no_access_token',
        'No Plex token provided. Please use the SignIn method or provide a X-Plex-Token in the Plex constructor.',
      );
    }
    return super.preRequestValidate(req);
  }

  static getThumbUrl(opts: {
    uri: string;
    accessToken: string;
    itemKey: string;
    width?: number;
    height?: number;
    upscale?: string;
  }): string {
    const { uri, accessToken, itemKey, width, height, upscale } = opts;
    const cleanKey = itemKey.replaceAll(/\/library\/metadata\//g, '');

    let thumbUrl: URL;
    const key = `/library/metadata/${cleanKey}/thumb?X-Plex-Token=${accessToken}`;
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
}

type PlexTvDevicesResponse = {
  MediaContainer: { Device: PlexResource[] };
};
