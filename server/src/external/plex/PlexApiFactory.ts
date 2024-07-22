import { forEach, isBoolean, isNull, isUndefined } from 'lodash-es';
import NodeCache from 'node-cache';
import { getEm } from '../../dao/dataSource.js';
import {
  MediaSource,
  MediaSourceType,
} from '../../dao/entities/MediaSource.js';
import { PlexApiClient, PlexApiOptions } from './PlexApiClient.js';
import { SettingsDB, getSettings } from '../../dao/settings.js';
import { isDefined } from '../../util/index.js';
import { JellyfinApiClient } from '../jellyfin/JellyfinApiClient.js';
import { FindChild } from '@tunarr/types';
import { RemoteMediaSourceOptions } from '../BaseApiClient.js';

type TypeToClient = [
  [MediaSourceType.Plex, PlexApiClient],
  [MediaSourceType.Jellyfin, JellyfinApiClient],
];

let instance: PlexApiFactoryImpl;

export class PlexApiFactoryImpl {
  #cache: NodeCache;
  #requestCacheEnabled: boolean | Record<string, boolean> = false;

  constructor(private settings: SettingsDB = getSettings()) {
    this.#cache = new NodeCache({
      useClones: false,
      deleteOnExpire: true,
      checkperiod: 60,
    });

    this.#requestCacheEnabled =
      settings.systemSettings().cache?.enablePlexRequestCache ?? false;

    this.settings.addListener('change', () => {
      this.#requestCacheEnabled =
        settings.systemSettings().cache?.enablePlexRequestCache ?? false;
      forEach(this.#cache.data, (data, key) => {
        const plex = data.v as PlexApiClient;
        if (isDefined(plex)) {
          plex.setEnableRequestCache(this.requestCacheEnabledForServer(key));
        }
      });
    });
  }

  getTyped<X extends MediaSourceType, ApiClient = FindChild<X, TypeToClient>>(
    typ: X,
    opts: RemoteMediaSourceOptions,
    factory: (opts: RemoteMediaSourceOptions) => ApiClient,
  ): ApiClient {
    const key = `${typ}|${opts.uri}|${opts.apiKey}`;
    let client = this.#cache.get<ApiClient>(key);
    if (!client) {
      // client = new PlexApiClient({
      //   ...opts,
      //   enableRequestCache: this.requestCacheEnabledForServer(opts.name),
      // });
      client = factory(opts);
      this.#cache.set(key, client);
    }

    return client;
  }

  getJellyfinClient(opts: RemoteMediaSourceOptions) {
    return this.getTyped(
      MediaSourceType.Jellyfin,
      opts,
      (opts) => new JellyfinApiClient(opts),
    );
  }

  async getOrSet(name: string) {
    let client = this.#cache.get<PlexApiClient>(name);
    if (isUndefined(client)) {
      const em = getEm();
      const server = await em.repo(MediaSource).findOne({ name });
      if (!isNull(server)) {
        client = new PlexApiClient({
          ...server,
          enableRequestCache: this.requestCacheEnabledForServer(server.name),
        });
        this.#cache.set(server.name, client);
      }
    }
    return client;
  }

  get(opts: PlexApiOptions) {
    const key = `${opts.uri}|${opts.accessToken}`;
    let client = this.#cache.get<PlexApiClient>(key);
    if (!client) {
      client = new PlexApiClient({
        ...opts,
        enableRequestCache: this.requestCacheEnabledForServer(opts.name),
      });
      this.#cache.set(key, client);
    }

    return client;
  }

  private requestCacheEnabledForServer(id: string) {
    return isBoolean(this.#requestCacheEnabled)
      ? this.#requestCacheEnabled
      : this.#requestCacheEnabled[id];
  }
}

export const PlexApiFactory = () => {
  if (!instance) {
    instance = new PlexApiFactoryImpl();
  }
  return instance;
};
