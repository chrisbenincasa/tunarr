import { MediaSourceDB } from '@/db/mediaSourceDB.js';
import type { MediaSource } from '@/db/schema/MediaSource.js';
import { MediaSourceType } from '@/db/schema/MediaSource.js';
import type { Maybe } from '@/types/util.js';
import { isDefined, isNonEmptyString } from '@/util/index.js';
import type { FindChild } from '@tunarr/types';
import dayjs from 'dayjs';
import { inject, injectable, LazyServiceIdentifier } from 'inversify';
import { forEach, isBoolean, isEmpty, isNil } from 'lodash-es';
import NodeCache from 'node-cache';
import { MarkRequired } from 'ts-essentials';
import type { ISettingsDB } from '../db/interfaces/ISettingsDB.ts';
import { KEYS } from '../types/inject.ts';
import { Result } from '../types/result.ts';
import { cacheGetOrSet } from '../util/cache.ts';
import { Logger } from '../util/logging/LoggerFactory.ts';
import {
  isQueryError,
  type ApiClientOptions,
  type BaseApiClient,
} from './BaseApiClient.js';
import { EmbyApiClient } from './emby/EmbyApiClient.ts';
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

  getJellyfinApiClientForMediaSource(mediaSource: MediaSource) {
    return this.getJellyfinApiClient(mediaSourceToApiOptions(mediaSource));
  }

  getJellyfinApiClient(opts: ApiClientOptions) {
    return this.getTyped(MediaSourceType.Jellyfin, opts, (opts) => {
      return Promise.resolve(new JellyfinApiClient(opts));
    });
  }

  getEmbyApiClientForMediaSource(mediaSource: MediaSource) {
    return this.getEmbyApiClient(mediaSourceToApiOptions(mediaSource));
  }

  getEmbyApiClient(opts: ApiClientOptions) {
    return this.getTyped(MediaSourceType.Jellyfin, opts, async (opts) => {
      let userId = opts.userId;
      let username: Maybe<string>;
      if (isEmpty(userId)) {
        this.logger.warn(
          'Emby connection does not have a user ID set. This could lead to errors. Please reconnect Emby.',
        );
        const adminResult = await Result.attemptAsync(() =>
          EmbyApiClient.findAdminUser(opts, opts.accessToken),
        );

        adminResult
          .filter((res) => isNonEmptyString(res?.Id))
          .forEach((adminUser) => {
            userId = adminUser!.Id!;
            username = adminUser!.Name ?? undefined;
          });
      }

      if (
        isNonEmptyString(opts.mediaSourceUuid) &&
        (isEmpty(opts.userId) ||
          opts.userId !== userId ||
          isEmpty(opts.username) ||
          opts.username != username)
      ) {
        this.mediaSourceDB
          .setMediaSourceUserInfo(opts.mediaSourceUuid, {
            userId: userId ?? undefined,
            username,
          })
          .catch((e) => {
            this.logger.error(
              e,
              'Error updating Jellyfin media source user info',
            );
          });
      }

      return new EmbyApiClient({ ...opts, userId });
    });
  }

  getPlexApiClientForMediaSource(
    mediaSource: MediaSource,
  ): Promise<PlexApiClient> {
    const opts = mediaSourceToApiOptions(mediaSource);
    return this.getPlexApiClient(opts);
  }

  getPlexApiClient(opts: ApiClientOptions): Promise<PlexApiClient> {
    const key = `${opts.url}|${opts.accessToken}`;
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
      const client = new PlexApiClient({
        ...mediaSource,
        url: mediaSource.uri,
        enableRequestCache: this.requestCacheEnabledForServer(mediaSource.name),
      });

      if (isEmpty(mediaSource.userId) || isEmpty(mediaSource.username)) {
        // Swallow error, it's logged below.
        this.backfillPlexUserId(mediaSource.uuid, client).catch(() => {});
      }

      return client;
    });
  }

  async getJellyfinApiClientByName(name: string, userId?: string) {
    return this.getTypedByName(
      MediaSourceType.Jellyfin,
      name,
      (opts) =>
        new JellyfinApiClient({
          ...opts,
          url: opts.uri,
          userId: opts.userId ?? userId ?? null,
        }),
    );
  }

  async getEmbyApiClientByName(name: string, userId?: string) {
    return this.getTypedByName(
      MediaSourceType.Emby,
      name,
      (opts) =>
        new EmbyApiClient({
          ...opts,
          url: opts.uri,
          userId: opts.userId ?? userId ?? null,
        }),
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
      this.getCacheKey(typ, opts.url, opts.accessToken),
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

  private async backfillPlexUserId(
    mediaSourceId: string,
    client: PlexApiClient,
  ) {
    this.logger.debug('Attempting to backfill Plex user');
    const result = await Result.attemptAsync(async () => {
      const user = await client.getUser();
      if (isQueryError(user)) {
        throw new Error(user.message);
      }

      await this.mediaSourceDB.setMediaSourceUserInfo(mediaSourceId, {
        userId: user.data.id?.toString(),
        username: user.data.username,
      });
    });
    if (result.isFailure()) {
      this.logger.error(
        result.error,
        'Error while attempting to backfill Plex user information',
      );
    }
  }
}

export function mediaSourceToApiOptions(
  mediaSource: MediaSource,
): MarkRequired<ApiClientOptions, 'mediaSourceUuid'> {
  return {
    ...mediaSource,
    url: mediaSource.uri,
    mediaSourceUuid: mediaSource.uuid,
  };
}
