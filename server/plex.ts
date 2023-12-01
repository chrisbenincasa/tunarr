import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
  RawAxiosRequestHeaders,
  isAxiosError,
} from 'axios';
import { isUndefined } from 'lodash-es';
import querystring, { ParsedUrlQueryInput } from 'querystring';
import createLogger from './logger.js';
import { Maybe } from './types.js';
import {
  PlexMediaContainer,
  PlexMediaContainerResponse,
} from './types/plexApiTypes.js';
import { PlexServerSettings } from 'dizquetv-types';

type AxiosConfigWithMetadata = InternalAxiosRequestConfig & {
  metadata: {
    startTime: number;
  };
};

const logger = createLogger(import.meta);
export class Plex {
  private axiosInstance: AxiosInstance;
  private _accessToken: string;
  private _headers: object;

  constructor(opts: Partial<PlexServerSettings>) {
    this._accessToken =
      typeof opts.accessToken !== 'undefined' ? opts.accessToken : '';
    let uri = 'http://127.0.0.1:32400';
    if (typeof opts.uri !== 'undefined') {
      uri = opts.uri;
      if (uri.endsWith('/')) {
        uri = uri.slice(0, uri.length - 1);
      }
    }

    this._headers = {
      Accept: 'application/json',
      'X-Plex-Device': 'dizqueTV',
      'X-Plex-Device-Name': 'dizqueTV',
      'X-Plex-Product': 'dizqueTV',
      'X-Plex-Version': '0.1',
      'X-Plex-Client-Identifier': 'rg14zekk3pa5zp4safjwaa8z',
      'X-Plex-Platform': 'Chrome',
      'X-Plex-Platform-Version': '80.0',
      'X-Plex-Token': this._accessToken,
    };

    this.axiosInstance = axios.create({
      baseURL: uri,
      headers: this._headers,
    });

    this.axiosInstance.interceptors.request.use((req) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      (req as AxiosConfigWithMetadata).metadata = {
        startTime: new Date().getTime(),
      };
      return req;
    });

    const logAxiosRequest = (req: AxiosConfigWithMetadata) => {
      const query = req.params
        ? // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          `?${querystring.stringify(req.params)}`
        : '';
      const elapsedTime = new Date().getTime() - req.metadata.startTime;
      logger.debug(
        `[Axios Request]: ${req.method?.toUpperCase()} ${req.baseURL}${
          req.url
        }${query} - ${elapsedTime}ms`,
      );
    };

    this.axiosInstance.interceptors.response.use(
      (resp) => {
        logAxiosRequest(resp.config as AxiosConfigWithMetadata);
        return resp;
      },
      (err) => {
        if (isAxiosError(err) && err.config) {
          logAxiosRequest(err.config as AxiosConfigWithMetadata);
        }
        throw err;
      },
    );
  }

  async SignIn(username: string, password: string) {
    if (isUndefined(username === 'undefined' || typeof password))
      throw new Error(
        "Plex 'SignIn' Error - No Username or Password was provided to sign in.",
      );
    const req: AxiosRequestConfig = {
      method: 'post',
      url: 'https://plex.tv/users/sign_in.json',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
      data: querystring.stringify({
        'user.login': username,
        'user.password': password,
      }),
    };

    const res = await axios.request(req);
    this._accessToken = res.data.user.authToken;
    return this._accessToken;
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

  async Get<T>(
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

  Put(
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

  Post(
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
      await this.Get('/');
      return 1;
    } catch (err) {
      console.error('Error getting Plex server status', err);
      return -1;
    }
  }

  async GetDVRS() {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await this.Get<any>('/livetv/dvrs');
      let dvrs = result?.Dvr;
      dvrs = isUndefined(dvrs) ? [] : dvrs;
      return dvrs;
    } catch (err) {
      logger.error('GET /livetv/drs failed: ', err);
      throw err;
    }
  }

  async RefreshGuide(_dvrs) {
    try {
      const dvrs = typeof _dvrs !== 'undefined' ? _dvrs : await this.GetDVRS();
      for (let i = 0; i < dvrs.length; i++) {
        await this.Post(`/livetv/dvrs/${dvrs[i].key}/reloadGuide`);
      }
    } catch (err) {
      throw Error('Zort', err);
    }
  }

  async RefreshChannels(channels, _dvrs) {
    const dvrs = typeof _dvrs !== 'undefined' ? _dvrs : await this.GetDVRS();
    const _channels: any[] = [];
    const qs: Record<string, string> = {};
    for (var i = 0; i < channels.length; i++) {
      _channels.push(channels[i].number);
    }
    qs.channelsEnabled = _channels.join(',');
    for (var i = 0; i < _channels.length; i++) {
      qs[`channelMapping[${_channels[i]}]`] = _channels[i];
      qs[`channelMappingByKey[${_channels[i]}]`] = _channels[i];
    }
    for (var i = 0; i < dvrs.length; i++) {
      for (let y = 0; y < dvrs[i].Device.length; y++) {
        await this.Put(
          `/media/grabbers/devices/${dvrs[i].Device[y].key}/channelmap`,
          qs,
        );
      }
    }
  }
}
