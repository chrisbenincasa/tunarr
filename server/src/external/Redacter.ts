import type { InternalAxiosRequestConfig } from 'axios';

interface Redacter<Input> {
  // Potentially mutates innput
  redact(input: Input): Input;
}

export abstract class AxiosRequestRedacter
  implements Redacter<InternalAxiosRequestConfig>
{
  redact(
    conf: InternalAxiosRequestConfig<unknown>,
  ): InternalAxiosRequestConfig<unknown> {
    if (conf.headers) {
      if (conf.headers.Authorization) {
        conf.headers.Authorization = '<REDACTED>';
      }
    }

    return conf;
  }
}
