import { AxiosRequestRedacter } from '@/external/Redacter.js';
import type { InternalAxiosRequestConfig } from 'axios';
import { isObject } from 'lodash-es';

export class EmbyRequestRedacter extends AxiosRequestRedacter {
  redact(
    conf: InternalAxiosRequestConfig<unknown>,
  ): InternalAxiosRequestConfig<unknown> {
    conf = super.redact(conf);
    if (conf.url?.includes('/AuthenticateByName')) {
      conf.data = '<REDACTED>';
    }

    if (conf.headers) {
      if (conf.headers['X-Emby-Token']) {
        conf.headers['X-Emby-Token'] = '<REDACTED>';
      }
    }

    if (conf.params && isObject(conf.params)) {
      if (conf.params['X-Emby-Token']) {
        conf.headers['X-Emby-Token'] = '<REDACTED>';
      }
    }

    return conf;
  }
}
