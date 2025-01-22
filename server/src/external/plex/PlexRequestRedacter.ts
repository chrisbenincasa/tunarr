import { AxiosRequestRedacter } from '@/external/Redacter.js';
import type { InternalAxiosRequestConfig } from 'axios';
import { isObject } from 'lodash-es';

export class PlexRequestRedacter extends AxiosRequestRedacter {
  redact(
    conf: InternalAxiosRequestConfig<unknown>,
  ): InternalAxiosRequestConfig<unknown> {
    conf = super.redact(conf);
    if (conf.headers) {
      if (conf.headers.Authorization) {
        conf.headers.Authorization = '<REDACTED>';
      }

      if (conf.headers['X-Plex-Token']) {
        conf.headers['X-Plex-Token'] = '<REDACTED>';
      }
    }

    if (conf.params && isObject(conf.params)) {
      if (conf.params['X-Plex-Token']) {
        conf.params['X-Plex-Token'] = '<REDACTED>';
      }
    }

    return conf;
  }
}
