import { EntityDTO } from '@mikro-orm/core';
import { PlexDvr, PlexDvrsResponse, PlexResource } from '@tunarr/types/plex';
import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
  RawAxiosRequestHeaders,
  isAxiosError,
} from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { isNil, isUndefined } from 'lodash-es';
import NodeCache from 'node-cache';
import querystring, { ParsedUrlQueryInput } from 'querystring';
import { PlexServerSettings } from './dao/entities/PlexServerSettings.js';
import createLogger from './logger.js';
import { Maybe } from './types.js';
import {
  PlexMediaContainer,
  PlexMediaContainerResponse,
} from './types/plexApiTypes.js';

const ClientIdentifier = 'p86cy1w47clco3ro8t92nfy1';

type AxiosConfigWithMetadata = InternalAxiosRequestConfig & {
  metadata: {
    startTime: number;
  };
};

const logger = createLogger(import.meta);

const DEFAULT_HEADERS = {
  Accept: 'application/json',
  'X-Plex-Device': 'Tunarr',
  'X-Plex-Device-Name': 'Tunarr',
  'X-Plex-Product': 'Tunarr',
  'X-Plex-Version': '0.1',
  'X-Plex-Client-Identifier': ClientIdentifier,
  'X-Plex-Platform': 'Chrome',
  'X-Plex-Platform-Version': '80.0',
};

type PlexApiOptions = Pick<
  EntityDTO<PlexServerSettings>,
  'accessToken' | 'uri'
>;

class PlexApiFactoryImpl {
  #cache: NodeCache;

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
  private axiosInstance: AxiosInstance;
  private _accessToken: string;

  constructor(opts: PlexApiOptions) {
    this._accessToken = opts.accessToken;
    const uri = opts.uri.endsWith('/')
      ? opts.uri.slice(0, opts.uri.length - 1)
      : opts.uri;

    this.axiosInstance = axios.create({
      baseURL: uri,
      headers: {
        ...DEFAULT_HEADERS,
        'X-Plex-Token': this._accessToken,
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
      logger.debug(
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

  private async doRequest<T>(req: AxiosRequestConfig): Promise<Maybe<T>> {
    try {
      const response = await this.axiosInstance.request<T>(req);
      return response.data;
    } catch (error) {
      if (isAxiosError(error)) {
        if (error.response?.status === 404) {
          logger.warn(
            `Not found: ${this.axiosInstance.defaults.baseURL}${req.url}`,
          );
        }
        if (error.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          logger.warn(error.response?.data);
          logger.warn(error.response?.status);
          logger.warn(error.response?.headers);
        } else if (error.request) {
          logger.error('Error requesting Plex ' + error.message);
        } else {
          logger.error('Error requesting Plex' + error.message);
        }
      }
      return;
    }
  }

  async doGet<T>(
    path: string,
    optionalHeaders: RawAxiosRequestHeaders = {},
  ): Promise<Maybe<PlexMediaContainer<T>>> {
    const req: AxiosRequestConfig = {
      method: 'get',
      url: path,
      headers: optionalHeaders,
    };

    if (this._accessToken === '') {
      throw Error(
        'No Plex token provided. Please use the SignIn method or provide a X-Plex-Token in the Plex constructor.',
      );
    }

    const res = await this.doRequest<PlexMediaContainerResponse<T>>(req);
    if (!res?.MediaContainer) {
      logger.error('Expected MediaContainer, got %O', res);
    }
    return res?.MediaContainer;
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

    if (this._accessToken === '') {
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

    if (this._accessToken === '') {
      throw Error(
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
      logger.error('GET /livetv/drs failed: ', err);
      throw err;
    }
  }

  async getResources() {}

  async refreshGuide(_dvrs?: PlexDvr[]) {
    const dvrs = !isUndefined(_dvrs) ? _dvrs : await this.getDvrs();
    if (!dvrs) {
      throw new Error('Could not retrieve Plex DVRs');
    }
    for (let i = 0; i < dvrs.length; i++) {
      await this.doPost(`/livetv/dvrs/${dvrs[i].key}/reloadGuide`);
    }
  }

  async refreshChannels(channels: { number: number }[], _dvrs?: PlexDvr[]) {
    const dvrs = !isUndefined(_dvrs) ? _dvrs : await this.getDvrs();
    if (!dvrs) throw new Error('Could not retrieve Plex DVRs');

    const _channels: number[] = [];
    const qs: Record<string, number | string> = {};
    for (let i = 0; i < channels.length; i++) {
      _channels.push(channels[i].number);
    }
    qs.channelsEnabled = _channels.join(',');
    for (let i = 0; i < _channels.length; i++) {
      qs[`channelMapping[${_channels[i]}]`] = _channels[i];
      qs[`channelMappingByKey[${_channels[i]}]`] = _channels[i];
    }
    for (let i = 0; i < dvrs.length; i++) {
      for (let y = 0; y < dvrs[i].Device.length; y++) {
        await this.doPut(
          `/media/grabbers/devices/${dvrs[i].Device[y].key}/channelmap`,
          qs,
        );
      }
    }
  }

  async getDevices(): Promise<Maybe<PlexTvDevicesResponse>> {
    const response = await this.doRequest<string>({
      method: 'get',
      baseURL: 'https://plex.tv',
      url: '/devices.xml',
    });

    if (isNil(response)) {
      return;
    }

    const parsed = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
    }).parse(response) as PlexTvDevicesResponse;
    return parsed;
  }
}

type PlexTvDevicesResponse = {
  MediaContainer: { Device: PlexResource[] };
};
