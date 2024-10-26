import { AxiosInstance, InternalAxiosRequestConfig, isAxiosError } from 'axios';
import querystring from 'node:querystring';
import { Logger } from './logging/LoggerFactory.ts';

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
    logger.http(
      `[Axios Request]: ${req.method?.toUpperCase()} ${req.baseURL}${
        req.url
      }${query} - (${status}) ${elapsedTime}ms`,
    );
  };

  instance.interceptors.request.use((req) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
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
