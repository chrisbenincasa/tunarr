import { AxiosRequestRedacter } from '@/external/Redacter.js';
import { Maybe, Try } from '@/types/util.js';
import { configureAxiosLogging } from '@/util/axios.js';
import { isDefined } from '@/util/index.js';
import { Logger, LoggerFactory } from '@/util/logging/LoggerFactory.js';
import axios, {
  AxiosHeaderValue,
  AxiosInstance,
  AxiosRequestConfig,
  isAxiosError,
} from 'axios';
import { isError, isString } from 'lodash-es';
import { z } from 'zod';

export type ApiClientOptions = {
  name?: string;
  url: string;
  extraHeaders?: {
    [key: string]: AxiosHeaderValue;
  };
};

export type RemoteMediaSourceOptions = ApiClientOptions & {
  apiKey: string;
};

export type QuerySuccessResult<T> = {
  type: 'success';
  data: T;
};

type QueryErrorCode =
  | 'not_found'
  | 'no_access_token'
  | 'parse_error'
  | 'generic_request_error';

export type QueryErrorResult = {
  type: 'error';
  code: QueryErrorCode;
  message?: string;
};

export type QueryResult<T> = QuerySuccessResult<T> | QueryErrorResult;

export function isQueryError(x: QueryResult<unknown>): x is QueryErrorResult {
  return x.type === 'error';
}

export function isQuerySuccess<T>(
  x: QueryResult<T>,
): x is QuerySuccessResult<T> {
  return x.type === 'success';
}

export abstract class BaseApiClient<
  OptionsType extends ApiClientOptions = ApiClientOptions,
> {
  protected logger: Logger;
  protected axiosInstance: AxiosInstance;
  protected redacter?: AxiosRequestRedacter;

  constructor(protected options: OptionsType) {
    this.logger = LoggerFactory.child({
      className: this.constructor.name,
      serverName: options.name,
    });

    const url = options.url.endsWith('/')
      ? options.url.slice(0, options.url.length - 1)
      : options.url;

    this.axiosInstance = axios.create({
      baseURL: url,
      headers: {
        Accept: 'application/json',
        ...(options.extraHeaders ?? {}),
      },
    });

    configureAxiosLogging(this.axiosInstance, this.logger);
  }

  async doTypeCheckedGet<T extends z.ZodTypeAny, Out = z.infer<T>>(
    path: string,
    schema: T,
    extraConfig: Partial<AxiosRequestConfig> = {},
  ): Promise<QueryResult<Out>> {
    const req: AxiosRequestConfig = {
      ...extraConfig,
      method: 'get',
      url: path,
    };

    const response = await this.doRequest<unknown>(req);

    if (isError(response)) {
      if (isAxiosError(response) && response.response?.status === 404) {
        return this.makeErrorResult('not_found');
      }
      return this.makeErrorResult('generic_request_error', response.message);
    }

    const parsed = await schema.safeParseAsync(response);

    if (parsed.success) {
      return this.makeSuccessResult(parsed.data as Out);
    }

    this.logger.error(
      parsed.error,
      'Unable to parse schema from response. Path: %s',
      path,
    );

    return this.makeErrorResult('parse_error');
  }

  protected preRequestValidate(
    _req: AxiosRequestConfig,
  ): Maybe<QueryErrorResult> {
    return;
  }

  protected makeErrorResult(
    code: QueryErrorCode,
    message?: string,
  ): QueryErrorResult {
    return {
      type: 'error',
      code,
      message,
    };
  }

  protected makeSuccessResult<T>(data: T): QuerySuccessResult<T> {
    return {
      type: 'success',
      data,
    };
  }

  doGet<T>(req: Omit<AxiosRequestConfig, 'method'>) {
    return this.doRequest<T>({ method: 'get', ...req });
  }

  doPost<T>(req: Omit<AxiosRequestConfig, 'method'>) {
    return this.doRequest<T>({ method: 'post', ...req });
  }

  doPut<T>(req: Omit<AxiosRequestConfig, 'method'>) {
    return this.doRequest<T>({ method: 'put', ...req });
  }

  doHead(req: Omit<AxiosRequestConfig, 'method'>) {
    return this.doRequest({ method: 'head', ...req });
  }

  getFullUrl(path: string): string {
    const sanitizedPath = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(`${this.options.url}${sanitizedPath}`);
    return url.toString();
  }

  protected async doRequest<T>(req: AxiosRequestConfig): Promise<Try<T>> {
    try {
      const response = await this.axiosInstance.request<T>(req);
      return response.data;
    } catch (error) {
      if (isAxiosError(error)) {
        if (error.config) {
          this.redacter?.redact(error.config);
        }
        if (error.response?.status === 404) {
          this.logger.warn(
            `Not found: ${this.axiosInstance.defaults.baseURL}${req.url}`,
          );
        }
        if (isDefined(error.response)) {
          const { status, headers } = error.response;
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          this.logger.warn(
            'API client response error: path: %O, status %d, params: %O, data: %O, headers: %O',
            error.config?.url ?? '',
            status,
            error.config?.params,
            error.response.data,
            headers,
          );
        } else if (error.request) {
          this.logger.error(
            error,
            'API client request error: %s',
            error.message,
          );
        } else {
          this.logger.error(error, 'Request error: %s', error.message);
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
        return new Error('Unknown error');
      }
    }
  }
}
