import { SettingsDB, getSettings } from '@/db/SettingsDB.ts';
import { MediaSourceDB } from '@/db/mediaSourceDB.ts';
import { MediaSourceType } from '@/db/schema/MediaSource.ts';
import { registerSingletonInitializer } from '@/globals.ts';
import { Maybe } from '@/types/util.js';
import { isDefined } from '@/util/index.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import { FindChild } from '@tunarr/types';
import { forEach, isBoolean, isEmpty, isNil, isUndefined } from 'lodash-es';
import NodeCache from 'node-cache';
import { BaseApiClient, RemoteMediaSourceOptions } from './BaseApiClient.js';
import {
  JellyfinApiClient,
  JellyfinApiClientOptions,
} from './jellyfin/JellyfinApiClient.js';
import { PlexApiClient, PlexApiOptions } from './plex/PlexApiClient.js';

type TypeToClient = [
  [typeof MediaSourceType.Plex, PlexApiClient],
  [typeof MediaSourceType.Jellyfin, JellyfinApiClient],
];

let instance: MediaSourceApiFactoryImpl;

export class MediaSourceApiFactoryImpl {
  #logger = LoggerFactory.child({ className: MediaSourceApiFactoryImpl.name });
  #cache: NodeCache;
  #requestCacheEnabled: boolean | Record<string, boolean> = false;

  constructor(
    private mediaSourceDB: MediaSourceDB,
    private settings: SettingsDB = getSettings(),
  ) {
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
      forEach(this.#cache.data, ({ v: value }, key) => {
        if (isDefined(value) && value instanceof PlexApiClient) {
          value.setEnableRequestCache(this.requestCacheEnabledForServer(key));
        }
      });
    });
  }

  async getTyped<
    Typ extends MediaSourceType,
    ApiClient = FindChild<Typ, TypeToClient>,
    ApiClientOptions extends
      RemoteMediaSourceOptions = ApiClient extends BaseApiClient<infer Opts>
      ? Opts extends RemoteMediaSourceOptions
        ? Opts
        : never
      : never,
  >(
    typ: Typ,
    opts: ApiClientOptions,
    factory: (opts: ApiClientOptions) => Promise<ApiClient>,
  ): Promise<ApiClient> {
    const key = `${typ}|${opts.url}|${opts.apiKey}`;
    let client = this.#cache.get<ApiClient>(key);
    if (!client) {
      client = await factory(opts);
      this.#cache.set(key, client);
    }

    return client;
  }

  getJellyfinClient(opts: JellyfinApiClientOptions) {
    return this.getTyped(MediaSourceType.Jellyfin, opts, async (opts) => {
      if (isEmpty(opts.userId)) {
        // We might have an admin token, so attempt to exchange it.
        try {
          const adminUser = await JellyfinApiClient.findAdminUser(
            opts,
            opts.apiKey,
          );
          return new JellyfinApiClient({ ...opts, userId: adminUser?.Id });
        } catch (e) {
          this.#logger.warn(
            e,
            'Could not retrieve admin user for Jellyfin server',
          );
        }
      }
      return new JellyfinApiClient(opts);
    });
  }

  async getOrSet(name: string) {
    let client = this.#cache.get<PlexApiClient>(name);
    if (isUndefined(client)) {
      const server = await this.mediaSourceDB.getByName(name);
      if (!isNil(server)) {
        client = new PlexApiClient({
          ...server,
          clientIdentifier: server.clientIdentifier,
          enableRequestCache: this.requestCacheEnabledForServer(server.name),
        });
        this.#cache.set(server.name, client);
      }
    }
    return client;
  }

  async getTypedByName<
    X extends MediaSourceType,
    ApiClient = FindChild<X, TypeToClient>,
  >(
    type: X,
    name: string,
    factory: (opts: RemoteMediaSourceOptions) => ApiClient,
  ): Promise<Maybe<ApiClient>> {
    const key = `${type}|${name}`;
    let client = this.#cache.get<ApiClient>(key);
    if (isUndefined(client)) {
      const server = await this.mediaSourceDB.findByType(type, name);
      if (!isNil(server)) {
        client = factory({
          apiKey: server.accessToken,
          url: server.uri,
          name: server.name,
        });
        this.#cache.set(server.name, client);
      }
    }
    return client;
  }

  async getJellyfinByName(name: string) {
    return this.getTypedByName(
      MediaSourceType.Jellyfin,
      name,
      (opts) => new JellyfinApiClient(opts),
    );
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

registerSingletonInitializer((ctx) => {
  if (!instance) {
    instance = new MediaSourceApiFactoryImpl(ctx.mediaSourceDB);
  }
  return instance;
});

export const MediaSourceApiFactory = () => instance;
