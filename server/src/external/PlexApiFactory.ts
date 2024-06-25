import { forEach, isBoolean, isNull, isUndefined } from 'lodash-es';
import NodeCache from 'node-cache';
import { getEm } from '../dao/dataSource.js';
import { PlexServerSettings } from '../dao/entities/PlexServerSettings.js';
import { Plex, PlexApiOptions } from './plex.js';
import { SettingsDB, getSettings } from '../dao/settings.js';
import { isDefined } from '../util/index.js';

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
        const plex = data.v as Plex;
        if (isDefined(plex)) {
          plex.setEnableRequestCache(this.requestCacheEnabledForServer(key));
        }
      });
    });
  }

  async getOrSet(name: string) {
    let client = this.#cache.get<Plex>(name);
    if (isUndefined(client)) {
      const em = getEm();
      const server = await em.repo(PlexServerSettings).findOne({ name });
      if (!isNull(server)) {
        client = new Plex({
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
    let client = this.#cache.get<Plex>(key);
    if (!client) {
      client = new Plex({
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
