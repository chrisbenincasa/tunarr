import type { AxiosRequestRedacter } from '@/external/Redacter.js';
import type { Maybe } from '@/types/util.js';
import { configureAxiosLogging } from '@/util/axios.js';
import { isDefined, isNodeError } from '@/util/index.js';
import type { Logger } from '@/util/logging/LoggerFactory.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import { type TupleToUnion } from '@tunarr/types';
import type { MediaSourceUnhealthyStatus } from '@tunarr/types/api';
import type {
  AxiosHeaderValue,
  AxiosInstance,
  AxiosRequestConfig,
} from 'axios';
import axios, { isAxiosError } from 'axios';
import type { Duration } from 'dayjs/plugin/duration.js';
import { has, isError, isString } from 'lodash-es';
import PQueue from 'p-queue';
import type { StrictOmit } from 'ts-essentials';
import { z } from 'zod/v4';
import type { MediaSourceWithRelations } from '../db/schema/derivedTypes.js';
import { WrappedError } from '../types/errors.ts';
import { Result } from '../types/result.ts';

export type ApiClientOptions = {
  mediaSource: StrictOmit<
    MediaSourceWithRelations,
    | 'createdAt'
    | 'updatedAt'
    | 'clientIdentifier'
    | 'index'
    | 'sendChannelUpdates'
    | 'sendGuideUpdates'
  >;
  extraHeaders?: {
    [key: string]: AxiosHeaderValue;
  };
  enableRequestCache?: boolean;
  queueOpts?: {
    concurrency: number;
    interval: Duration;
  };
};

export type RemoteMediaSourceOptions = ApiClientOptions & {
  apiKey: string;
};

const QueryErrorCodes = [
  'not_found',
  'no_access_token',
  'parse_error',
  'generic_request_error',
] as const;
type QueryErrorCode = TupleToUnion<typeof QueryErrorCodes>;

export abstract class QueryError extends WrappedError {
  readonly type: QueryErrorCode;

  static isQueryError(e: unknown): e is QueryError {
    return (
      has(e, 'type') &&
      isString(e.type) &&
      QueryErrorCodes.some((x) => x === e.type)
    );
  }

  static genericQueryError(message?: string): QueryError {
    return this.create('generic_request_error', message);
  }

  static create(type: QueryErrorCode, message?: string): QueryError {
    return new (class extends QueryError {
      type = type;
    })(message);
  }
}

export type QueryResult<T> = Result<T, QueryError>;

export abstract class BaseApiClient<
  OptionsType extends ApiClientOptions = ApiClientOptions,
> {
  private queue?: PQueue;
  protected logger: Logger;
  protected axiosInstance: AxiosInstance;
  protected redacter?: AxiosRequestRedacter;

  constructor(protected options: OptionsType) {
    this.logger = LoggerFactory.child({
      className: this.constructor.name,
      serverName: options.mediaSource.name,
    });

    const url = options.mediaSource.uri.endsWith('/')
      ? options.mediaSource.uri.slice(0, options.mediaSource.uri.length - 1)
      : options.mediaSource.uri;
    this.options.mediaSource.uri = url;

    this.axiosInstance = axios.create({
      baseURL: url,
      headers: {
        Accept: 'application/json',
        ...(options.extraHeaders ?? {}),
      },
      timeout: 60_000,
    });

    if (options.queueOpts) {
      this.queue = new PQueue({
        concurrency: options.queueOpts.concurrency,
        interval: options.queueOpts.interval.asMilliseconds(),
      });
    }

    configureAxiosLogging(this.axiosInstance, this.logger);
  }

  setApiClientOptions(opts: OptionsType) {
    this.options = opts;
  }

  async doTypeCheckedGet<T extends z.ZodType, Out = z.infer<T>>(
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

    const parsed = await schema.safeParseAsync(response, {
      reportInput: true,
    });

    if (parsed.success) {
      return this.makeSuccessResult(parsed.data as Out);
    }

    this.logger.error(
      parsed.error,
      'Unable to parse schema from response. Path: %s\n%s. Issues: %s',
      path,
      z.prettifyError(parsed.error),
      JSON.stringify(parsed.error.issues, null, 2),
    );

    return this.makeErrorResult('parse_error');
  }

  protected preRequestValidate<T>(
    _req: AxiosRequestConfig,
  ): Maybe<QueryResult<T>> {
    return;
  }

  protected makeErrorResult<T>(
    type: QueryErrorCode,
    message?: string,
  ): QueryResult<T> {
    return Result.failure<T, QueryError>(
      QueryError.create(type, message ?? 'Unknown Error'),
    );
  }

  protected makeSuccessResult<T>(data: T): QueryResult<T> {
    return Result.success<T, QueryError>(data);
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
    const url = new URL(`${this.options.mediaSource.uri}${sanitizedPath}`);
    return url.toString();
  }

  protected async doRequest<T>(req: AxiosRequestConfig): Promise<T> {
    try {
      const response = await (this.queue
        ? this.queue.add(() => this.axiosInstance.request<T>(req), {
            throwOnTimeout: true,
          })
        : this.axiosInstance.request<T>(req));
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
            'API client response error: path: %s, status %d, params: %O, data: %O, headers: %O',
            error.config?.url ?? '',
            status,
            (error.config?.params as unknown) ?? {},
            error.response.data as unknown as object,
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
        throw error;
      } else if (isError(error)) {
        this.logger.error(error);
        throw error;
      } else if (isString(error)) {
        // Wrap it
        const err = new Error(error);
        this.logger.error(err);
        throw err;
      } else {
        // At this point we have no idea what the object is... attempt to log
        // and just return a generic error. Something is probably fatally wrong
        // at this point.
        this.logger.error(error, 'Unknown error type thrown: %O');
        throw new Error('Unknown error', { cause: error });
      }
    }
  }

  protected getHealthStatus(
    err: unknown,
  ): MediaSourceUnhealthyStatus['status'] {
    let status: MediaSourceUnhealthyStatus['status'] = 'unknown';
    if (isAxiosError(err)) {
      if (err.status === 401 || err.status === 403) {
        status = 'auth';
      }
    } else if (isNodeError(err)) {
      switch (err.code) {
        case 'ECONNREFUSED': {
          status = 'unreachable';
          break;
        }
        case 'ECONNRESET': {
          status = 'timeout';
          break;
        }
        default:
          break;
      }
    }

    return status;
  }

  protected findMatchingLibrary(externalLibraryId: string) {
    return this.options.mediaSource.libraries.find(
      (lib) => lib.externalKey === externalLibraryId,
    );
  }
}
