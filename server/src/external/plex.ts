import { EntityDTO } from '@mikro-orm/core';
import { DefaultPlexHeaders } from '@tunarr/shared/constants';
import {
  PlexDvr,
  PlexDvrsResponse,
  PlexMedia,
  PlexMediaContainerResponseSchema,
  PlexResource,
} from '@tunarr/types/plex';
import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
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
  isNull,
  isString,
  isUndefined,
  map,
} from 'lodash-es';
import NodeCache from 'node-cache';
import querystring, { ParsedUrlQueryInput } from 'querystring';
import { MarkOptional } from 'ts-essentials';
import { z } from 'zod';
import { PlexServerSettings } from '../dao/entities/PlexServerSettings.js';
import {
  PlexMediaContainer,
  PlexMediaContainerResponse,
} from '../types/plexApiTypes.js';
import { Maybe, Try } from '../types/util.js';
import { Logger, LoggerFactory } from '../util/logging/LoggerFactory.js';
import { isSuccess } from '../util/index.js';
import { getEm } from '../dao/dataSource.js';

type AxiosConfigWithMetadata = InternalAxiosRequestConfig & {
  metadata: {
    startTime: number;
  };
};

type PlexApiOptions = MarkOptional<
  Pick<
    EntityDTO<PlexServerSettings>,
    'accessToken' | 'uri' | 'name' | 'clientIdentifier'
  >,
  'clientIdentifier'
>;

type PlexQuerySuccessResult<T> = {
  type: 'success';
  data: T;
};

type PlexQueryErrorCode =
  | 'not_found'
  | 'no_access_token'
  | 'parse_error'
  | 'generic_request_error';

type PlexQueryErrorResult = {
  type: 'error';
  code: PlexQueryErrorCode;
  message?: string;
};

type PlexQueryResult<T> = PlexQuerySuccessResult<T> | PlexQueryErrorResult;

export function isPlexQueryError(
  x: PlexQueryResult<unknown>,
): x is PlexQueryErrorResult {
  return x.type === 'error';
}

export function isPlexQuerySuccess<T>(
  x: PlexQueryResult<T>,
): x is PlexQuerySuccessResult<T> {
  return x.type === 'success';
}

function makeErrorResult(
  code: PlexQueryErrorCode,
  message?: string,
): PlexQueryErrorResult {
  return {
    type: 'error',
    code,
    message,
  };
}

function makeSuccessResult<T>(data: T): PlexQuerySuccessResult<T> {
  return {
    type: 'success',
    data,
  };
}

class PlexApiFactoryImpl {
  #cache: NodeCache;

  constructor() {
    this.#cache = new NodeCache({
      useClones: false,
      deleteOnExpire: true,
      checkperiod: 60,
    });
  }

  async getOrSet(name: string) {
    let client = this.#cache.get<Plex>(name);
    if (isUndefined(client)) {
      const em = getEm();
      const server = await em.repo(PlexServerSettings).findOne({ name });
      if (!isNull(server)) {
        client = new Plex(server);
        this.#cache.set(server.name, client);
      }
    }
    return client;
  }

  get(opts: PlexApiOptions) {
    const key = `${opts.uri}|${opts.accessToken}`;
    let client = this.#cache.get<Plex>(key);
    if (!client) {
      client = new Plex(opts);
      this.#cache.set(key, client);
    }

    return client;
  }
}

export const PlexApiFactory = new PlexApiFactoryImpl();

export class Plex {
  private logger: Logger;
  private opts: PlexApiOptions;
  private axiosInstance: AxiosInstance;
  private accessToken: string;

  constructor(opts: PlexApiOptions) {
    this.opts = opts;
    this.accessToken = opts.accessToken;
    this.logger = LoggerFactory.child({ caller: import.meta });
    const uri = opts.uri.endsWith('/')
      ? opts.uri.slice(0, opts.uri.length - 1)
      : opts.uri;

    this.axiosInstance = axios.create({
      baseURL: uri,
      headers: {
        ...DefaultPlexHeaders,
        'X-Plex-Token': this.accessToken,
      },
    });

    this.axiosInstance.interceptors.request.use((req) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      (req as AxiosConfigWithMetadata).metadata = {
        startTime: new Date().getTime(),
      };
      return req;
    });

    const logAxiosRequest = (req: AxiosConfigWithMetadata, status: number) => {
      const query = req.params
        ? // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          `?${querystring.stringify(req.params)}`
        : '';
      const elapsedTime = new Date().getTime() - req.metadata.startTime;
      this.logger.http(
        `[Axios Request]: ${req.method?.toUpperCase()} ${req.baseURL}${
          req.url
        }${query} - (${status}) ${elapsedTime}ms`,
      );
    };

    this.axiosInstance.interceptors.response.use(
      (resp) => {
        logAxiosRequest(resp.config as AxiosConfigWithMetadata, resp.status);
        return resp;
      },
      (err) => {
        if (isAxiosError(err) && err.config) {
          logAxiosRequest(
            err.config as AxiosConfigWithMetadata,
            err.status ?? -1,
          );
        }
        throw err;
      },
    );
  }

  get serverName() {
    return this.opts.name;
  }

  private async doRequest<T>(req: AxiosRequestConfig): Promise<Try<T>> {
    try {
      const response = await this.axiosInstance.request<T>(req);
      return response.data;
    } catch (error) {
      if (isAxiosError(error)) {
        if (error.response?.status === 404) {
          this.logger.warn(
            `Not found: ${this.axiosInstance.defaults.baseURL}${req.url}`,
          );
        }
        if (!isUndefined(error.response)) {
          const { status, headers } = error.response;
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          this.logger.warn(
            'Plex response error: status %d, data: %O, headers: %O',
            status,
            error.response.data,
            headers,
          );
        } else if (error.request) {
          this.logger.error(error, 'Plex request error: %s', error.message);
        } else {
          this.logger.error(error, 'Error requesting Plex: %s', error.message);
        }
        return error;
      } else if (isError(error)) {
        this.logger.error(error);
        return error;
      } else if (isString(error)) {
        // Wrap it
        const err = new Error(error);
        this.logger.error(err);
        return err;
      } else {
        // At this point we have no idea what the object is... attempt to log
        // and just return a generic error. Something is probably fatally wrong
        // at this point.
        this.logger.error('Unknown error type thrown: %O', error);
        return new Error('Unknown error when requesting Plex');
      }
    }
  }

  // TODO: make all callers use this
  async doGetResult<T>(
    path: string,
    optionalHeaders: RawAxiosRequestHeaders = {},
  ): Promise<PlexQueryResult<PlexMediaContainer<T>>> {
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
        return makeErrorResult('parse_error');
      }

      return makeSuccessResult(res?.MediaContainer);
    }

    if (isAxiosError(res) && res.response?.status === 404) {
      return makeErrorResult('not_found');
    }

    return makeErrorResult('generic_request_error', res.message);
  }

  // We're just keeping the old contract here right now...
  async doGet<T>(
    path: string,
    optionalHeaders: RawAxiosRequestHeaders = {},
  ): Promise<Maybe<PlexMediaContainer<T>>> {
    const result = await this.doGetResult<PlexMediaContainer<T>>(
      path,
      optionalHeaders,
    );
    if (isPlexQuerySuccess(result)) {
      return result.data;
    } else {
      return;
    }
  }

  async doTypeCheckedGet<T extends z.ZodTypeAny, Out = z.infer<T>>(
    path: string,
    schema: T,
    extraConfig: Partial<AxiosRequestConfig> = {},
  ): Promise<PlexQueryResult<Out>> {
    const req: AxiosRequestConfig = {
      ...extraConfig,
      method: 'get',
      url: path,
    };

    if (isEmpty(this.accessToken)) {
      return makeErrorResult(
        'no_access_token',
        'No Plex token provided. Please use the SignIn method or provide a X-Plex-Token in the Plex constructor.',
      );
    }

    const response = await this.doRequest<unknown>(req);

    if (isError(response)) {
      if (isAxiosError(response) && response.response?.status === 404) {
        return makeErrorResult('not_found');
      }
      return makeErrorResult('generic_request_error', response.message);
    }

    const parsed = await schema.safeParseAsync(response);

    if (parsed.success) {
      return makeSuccessResult(parsed.data as Out);
    }

    this.logger.error(
      parsed.error,
      'Unable to parse schema from Plex response. Path: %s',
      path,
    );

    return makeErrorResult('parse_error');

    // if (isAxiosError(response) && response.res)
  }

  async getItemMetadata(key: string): Promise<PlexQueryResult<PlexMedia>> {
    const parsedResponse = await this.doTypeCheckedGet(
      `/library/metadata/${key}`,
      PlexMediaContainerResponseSchema,
    );

    if (isPlexQuerySuccess(parsedResponse)) {
      const media = first(parsedResponse.data.MediaContainer.Metadata);
      if (!isUndefined(media)) {
        return makeSuccessResult(media);
      }
      this.logger.error(
        'Could not extract Metadata object for Plex media, key = %s',
        key,
      );
      return makeErrorResult('parse_error');
    }

    return parsedResponse;
  }

  doPut(
    path: string,
    query: ParsedUrlQueryInput | URLSearchParams = {},
    optionalHeaders: RawAxiosRequestHeaders = {},
  ) {
    const req: AxiosRequestConfig = {
      method: 'put',
      url: path,
      params: query,
      headers: optionalHeaders,
    };

    if (this.accessToken === '') {
      throw Error(
        'No Plex token provided. Please use the SignIn method or provide a X-Plex-Token in the Plex constructor.',
      );
    }

    return this.doRequest(req);
  }

  doPost(
    path: string,
    query: ParsedUrlQueryInput | URLSearchParams = {},
    optionalHeaders: RawAxiosRequestHeaders = {},
  ) {
    const req: AxiosRequestConfig = {
      method: 'post',
      url: path,
      headers: optionalHeaders,
      params: query,
    };

    if (this.accessToken === '') {
      return makeErrorResult(
        'no_access_token',
        'No Plex token provided. Please use the SignIn method or provide a X-Plex-Token in the Plex constructor.',
      );
    }

    return this.doRequest(req);
  }

  async checkServerStatus() {
    try {
      await this.doGet('/');
      return 1;
    } catch (err) {
      console.error('Error getting Plex server status', err);
      return -1;
    }
  }

  async getDvrs() {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await this.doGet<PlexDvrsResponse>('/livetv/dvrs');
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
      await this.doPost(`/livetv/dvrs/${dvr.key}/reloadGuide`);
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
      await this.doPut(`/media/grabbers/devices/${key}/channelmap`, qs);
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
    return Plex.getThumbUrl({
      uri: this.opts.uri,
      accessToken: this.opts.accessToken,
      itemKey: opts.itemKey,
      width: opts.width,
      height: opts.height,
      upscale: opts.upscale,
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
