import { MediaSourceDB } from '@/db/mediaSourceDB.js';
import type { MediaSource } from '@/db/schema/MediaSource.js';
import { MediaSourceType } from '@/db/schema/MediaSource.js';
import type { Maybe } from '@/types/util.js';
import { isDefined } from '@/util/index.js';
import { type Logger } from '@/util/logging/LoggerFactory.js';
import type { FindChild } from '@tunarr/types';
import dayjs from 'dayjs';
import { inject, injectable, LazyServiceIdentifier } from 'inversify';
import { forEach, isBoolean, isEmpty, isNil } from 'lodash-es';
import NodeCache from 'node-cache';
import type { ISettingsDB } from '../db/interfaces/ISettingsDB.ts';
import { KEYS } from '../types/inject.ts';
import { cacheGetOrSet } from '../util/cache.ts';
import type { ApiClientOptions, BaseApiClient } from './BaseApiClient.js';
import { EmbyApiClient, EmbyApiClientOptions } from './emby/EmbyApiClient.ts';
import type { JellyfinApiClientOptions } from './jellyfin/JellyfinApiClient.js';
import { JellyfinApiClient } from './jellyfin/JellyfinApiClient.js';
import { PlexApiClient } from './plex/PlexApiClient.js';

type TypeToClient = [
  [typeof MediaSourceType.Plex, PlexApiClient],
  [typeof MediaSourceType.Jellyfin, JellyfinApiClient],
];

@injectable()
export class MediaSourceApiFactory {
  // TODO: Inject this
  private static cache = new NodeCache({
    useClones: false,
    deleteOnExpire: true,
    checkperiod: dayjs.duration(5, 'minutes').asSeconds(),
    stdTTL: dayjs.duration(1, 'hour').asSeconds(),
  });

  #requestCacheEnabled: boolean | Record<string, boolean> = false;

  constructor(
    @inject(KEYS.Logger) private logger: Logger,
    @inject(new LazyServiceIdentifier(() => MediaSourceDB))
    private mediaSourceDB: MediaSourceDB,
    @inject(KEYS.SettingsDB) private settings: ISettingsDB,
  ) {
    this.#requestCacheEnabled =
      settings.systemSettings().cache?.enablePlexRequestCache ?? false;

    this.settings.addListener('change', () => {
      this.#requestCacheEnabled =
        settings.systemSettings().cache?.enablePlexRequestCache ?? false;
      forEach(MediaSourceApiFactory.cache.data, ({ v: value }, key) => {
        if (isDefined(value) && value instanceof PlexApiClient) {
          value.setEnableRequestCache(this.requestCacheEnabledForServer(key));
        }
      });
    });
  }

  getJellyfinApiClient(opts: JellyfinApiClientOptions) {
    return this.getTyped(MediaSourceType.Jellyfin, opts, async (opts) => {
      if (isEmpty(opts.userId)) {
        // We might have an admin token, so attempt to exchange it.
        try {
          const adminUser = await JellyfinApiClient.findAdminUser(
            opts,
            opts.accessToken,
          );
          return new JellyfinApiClient({ ...opts, userId: adminUser?.Id });
        } catch (e) {
          this.logger.warn(
            e,
            'Could not retrieve admin user for Jellyfin server',
          );
        }
      }
      return new JellyfinApiClient(opts);
    });
  }

  getEmbyApiClient(opts: EmbyApiClientOptions) {
    return this.getTyped(MediaSourceType.Jellyfin, opts, async (opts) => {
      if (isEmpty(opts.userId)) {
        // We might have an admin token, so attempt to exchange it.
        try {
          const adminUser = await EmbyApiClient.findAdminUser(
            opts,
            opts.accessToken,
          );
          return new EmbyApiClient({ ...opts, userId: adminUser?.Id });
        } catch (e) {
          this.logger.warn(e, 'Could not retrieve admin user for Emby server');
        }
      }
      return new EmbyApiClient(opts);
    });
  }

  getPlexApiClient(opts: ApiClientOptions): Promise<PlexApiClient> {
    const key = `${opts.uri}|${opts.accessToken}`;
    return cacheGetOrSet(MediaSourceApiFactory.cache, key, () => {
      return Promise.resolve(
        new PlexApiClient({
          ...opts,
          enableRequestCache: this.requestCacheEnabledForServer(opts.name),
        }),
      );
    });
  }

  async getPlexApiClientByName(name: string) {
    return this.getTypedByName(MediaSourceType.Plex, name, (mediaSource) => {
      return new PlexApiClient({
        ...mediaSource,
        enableRequestCache: this.requestCacheEnabledForServer(mediaSource.name),
      });
    });
  }

  async getJellyfinApiClientByName(name: string, userId?: string) {
    return this.getTypedByName(
      MediaSourceType.Jellyfin,
      name,
      (opts) => new JellyfinApiClient({ ...opts, userId }),
    );
  }

  deleteCachedClient(mediaSource: MediaSource) {
    const key = this.getCacheKeyForMediaSource(mediaSource);
    return MediaSourceApiFactory.cache.del(key) === 1;
  }

  private async getTyped<
    Typ extends MediaSourceType,
    ApiClient = FindChild<Typ, TypeToClient>,
    ApiClientOptionsT extends
      ApiClientOptions = ApiClient extends BaseApiClient<infer Opts>
      ? Opts extends ApiClientOptions
        ? Opts
        : never
      : never,
  >(
    typ: Typ,
    opts: ApiClientOptionsT,
    factory: (opts: ApiClientOptionsT) => Promise<ApiClient>,
  ): Promise<ApiClient> {
    return await cacheGetOrSet<ApiClient>(
      MediaSourceApiFactory.cache,
      this.getCacheKey(typ, opts.uri, opts.accessToken),
      () => factory(opts),
    );
  }

  private async getTypedByName<
    X extends MediaSourceType,
    ApiClient = FindChild<X, TypeToClient>,
  >(
    type: X,
    name: string,
    factory: (opts: MediaSource) => ApiClient,
  ): Promise<Maybe<ApiClient>> {
    const key = `${type}|${name}`;
    return cacheGetOrSet<Maybe<ApiClient>>(
      MediaSourceApiFactory.cache,
      key,
      async () => {
        const mediaSource = await this.mediaSourceDB.findByType(type, name);
        if (!isNil(mediaSource)) {
          return factory(mediaSource);
        }
        return;
      },
    );
  }

  private requestCacheEnabledForServer(id: string) {
    return isBoolean(this.#requestCacheEnabled)
      ? this.#requestCacheEnabled
      : this.#requestCacheEnabled[id];
  }

  private getCacheKey(type: MediaSourceType, uri: string, accessToken: string) {
    return `${type}|${uri}|${accessToken}`;
  }

  private getCacheKeyForMediaSource(mediaSource: MediaSource): string {
    return this.getCacheKey(
      mediaSource.type,
      mediaSource.uri,
      mediaSource.accessToken,
    );
  }
}
