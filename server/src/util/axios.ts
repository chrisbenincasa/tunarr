import type {
  AxiosHeaderValue,
  AxiosInstance,
  AxiosResponseHeaders,
  InternalAxiosRequestConfig,
  RawAxiosResponseHeaders,
} from 'axios';
import { AxiosHeaders, isAxiosError } from 'axios';
import type { HttpHeader } from 'fastify/types/utils.js';
import { isNil, reduce } from 'lodash-es';
import querystring from 'node:querystring';
import { match, P } from 'ts-pattern';
import type { Logger } from './logging/LoggerFactory.ts';

type AxiosConfigWithMetadata = InternalAxiosRequestConfig & {
  metadata: {
    startTime: number;
  };
};

export function configureAxiosLogging(instance: AxiosInstance, logger: Logger) {
  const logAxiosRequest = (req: AxiosConfigWithMetadata, status: number) => {
    const query = req.params
      ? // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        `?${querystring.stringify(req.params)}`
      : '';
    const elapsedTime = new Date().getTime() - req.metadata.startTime;
    logger.http_out(
      '%s %s%s%s - (%d) %dms',
      req.method?.toUpperCase() ?? '',
      req.baseURL ?? '',
      req.url ?? '',
      query,
      status,
      elapsedTime,
    );
  };

  instance.interceptors.request.use((req) => {
    (req as AxiosConfigWithMetadata).metadata = {
      startTime: new Date().getTime(),
    };
    return req;
  });

  instance.interceptors.response.use(
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

export function extractAxiosHeaders(
  headers: RawAxiosResponseHeaders | AxiosResponseHeaders,
): Partial<Record<HttpHeader, string | string[] | number>> {
  if (headers instanceof AxiosHeaders) {
    return enumerateAxiosRawHeaders(headers.toJSON());
  }

  return enumerateAxiosRawHeaders(headers);
}

function enumerateAxiosRawHeaders(headers: {
  [key: string]: AxiosHeaderValue | undefined;
}): Partial<Record<HttpHeader, string | string[] | number>> {
  return reduce(
    Object.entries(headers),
    (headers, [key, val]) => {
      const value = match(val)
        .with(P.string, (str) => str)
        .with(P.array(P.string), (arr) => arr)
        .with(P.number, (n) => n)
        .with(P.boolean, (b) => (b ? 'true' : 'false'))
        .otherwise(() => null);
      if (!isNil(value)) {
        headers[key as HttpHeader] = value;
      }
      return headers;
    },
    {} as Partial<Record<HttpHeader, string | string[] | number>>,
  );
}
