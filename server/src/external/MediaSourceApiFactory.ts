import { MediaSourceDB } from '@/db/mediaSourceDB.js';
import { MediaSourceType } from '@/db/schema/base.js';
import type { MediaSource, MediaSourceOrm } from '@/db/schema/MediaSource.js';
import type { Maybe } from '@/types/util.js';
import { isDefined, isNonEmptyString } from '@/util/index.js';
import type { FindChild } from '@tunarr/types';
import dayjs from 'dayjs';
import { inject, injectable, LazyServiceIdentifier } from 'inversify';
import { forEach, isBoolean, isEmpty, isNil } from 'lodash-es';
import NodeCache from 'node-cache';
import type { ISettingsDB } from '../db/interfaces/ISettingsDB.ts';
import { MediaSourceId } from '../db/schema/base.js';
import { MediaSourceWithRelations } from '../db/schema/derivedTypes.js';
import { KEYS } from '../types/inject.ts';
import { Result } from '../types/result.ts';
import { cacheGetOrSet } from '../util/cache.ts';
import { Logger } from '../util/logging/LoggerFactory.ts';
import { type ApiClientOptions } from './BaseApiClient.js';
import { EmbyApiClient } from './emby/EmbyApiClient.ts';
import { JellyfinApiClient } from './jellyfin/JellyfinApiClient.js';
import { MediaSourceApiClientFactory } from './MediaSourceApiClient.ts';
import { PlexApiClient, PlexApiClientFactory } from './plex/PlexApiClient.js';

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
    @inject(KEYS.PlexApiClientFactory)
    private plexApiClientFactory: PlexApiClientFactory,
    @inject(KEYS.JellyfinApiClientFactory)
    private jellyfinApiClientFactory: MediaSourceApiClientFactory<JellyfinApiClient>,
    @inject(KEYS.EmbyApiClientFactory)
    private embyApiClientFactory: MediaSourceApiClientFactory<EmbyApiClient>,
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

  getJellyfinApiClientForMediaSource(mediaSource: MediaSourceWithRelations) {
    return this.getJellyfinApiClient({ mediaSource });
  }

  getJellyfinApiClient(opts: ApiClientOptions): Promise<JellyfinApiClient> {
    const client = this.jellyfinApiClientFactory(opts);
    client.setApiClientOptions(opts);
    return Promise.resolve(client);
  }

  getEmbyApiClientForMediaSource(mediaSource: MediaSourceWithRelations) {
    return this.getEmbyApiClient({ mediaSource });
  }

  async getEmbyApiClient(opts: ApiClientOptions) {
    let userId = opts.mediaSource.userId;
    let username: Maybe<string>;
    if (isEmpty(userId)) {
      this.logger.warn(
        'Emby connection does not have a user ID set. This could lead to errors. Please reconnect Emby.',
      );
      const adminResult = await Result.attemptAsync(() =>
        EmbyApiClient.findAdminUser(opts, opts.mediaSource.accessToken),
      );

      adminResult
        .filter((res) => isNonEmptyString(res?.Id))
        .forEach((adminUser) => {
          userId = adminUser!.Id!;
          username = adminUser!.Name ?? undefined;
        });
    }

    if (
      isNonEmptyString(opts.mediaSource.uuid) &&
      (isEmpty(opts.mediaSource.userId) ||
        opts.mediaSource.userId !== userId ||
        isEmpty(opts.mediaSource.username) ||
        opts.mediaSource.username != username)
    ) {
      this.mediaSourceDB
        .setMediaSourceUserInfo(opts.mediaSource.uuid, {
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

    return this.embyApiClientFactory({
      ...opts,
      mediaSource: { ...opts.mediaSource, userId },
    });
  }

  getPlexApiClientForMediaSource(
    mediaSource: MediaSourceWithRelations,
  ): Promise<PlexApiClient> {
    return this.getPlexApiClient({ mediaSource });
  }

  getPlexApiClient(opts: ApiClientOptions): Promise<PlexApiClient> {
    return Promise.resolve(
      this.plexApiClientFactory({
        ...opts,
        enableRequestCache: this.requestCacheEnabledForServer(
          opts.mediaSource.name,
        ),
      }),
    );
  }

  async getPlexApiClientById(name: MediaSourceId) {
    return this.getTypedByName(MediaSourceType.Plex, name, (mediaSource) => {
      const client = this.plexApiClientFactory({
        mediaSource,
        enableRequestCache: this.requestCacheEnabledForServer(mediaSource.name),
      });

      if (isEmpty(mediaSource.userId) || isEmpty(mediaSource.username)) {
        // Swallow error, it's logged below.
        this.backfillPlexUserId(mediaSource.uuid, client).catch(() => {});
      }

      return client;
    });
  }

  async getJellyfinApiClientById(name: MediaSourceId, userId?: string) {
    return this.getTypedByName(MediaSourceType.Jellyfin, name, (opts) =>
      this.jellyfinApiClientFactory({
        mediaSource: {
          ...opts,
          userId: opts.userId ?? userId ?? null,
        },
      }),
    );
  }

  async getEmbyApiClientById(name: MediaSourceId, userId?: string) {
    return this.getTypedByName(MediaSourceType.Emby, name, (opts) =>
      this.embyApiClientFactory({
        mediaSource: {
          ...opts,
          userId: opts.userId ?? userId ?? null,
        },
      }),
    );
  }

  deleteCachedClient(mediaSource: MediaSourceOrm) {
    const key = this.getCacheKeyForMediaSource(mediaSource);
    return MediaSourceApiFactory.cache.del(key) === 1;
  }

  private async getTypedByName<
    X extends MediaSourceType,
    ApiClient = FindChild<X, TypeToClient>,
  >(
    type: X,
    name: MediaSourceId,
    factory: (opts: MediaSourceWithRelations) => ApiClient,
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
      : (this.#requestCacheEnabled[id] ?? false);
  }

  private getCacheKey(type: MediaSourceType, uri: string, accessToken: string) {
    return `${type}|${uri}|${accessToken}`;
  }

  private getCacheKeyForMediaSource(
    mediaSource: MediaSource | MediaSourceOrm,
  ): string {
    return this.getCacheKey(
      mediaSource.type,
      mediaSource.uri,
      mediaSource.accessToken,
    );
  }

  private async backfillPlexUserId(
    mediaSourceId: MediaSourceId,
    client: PlexApiClient,
  ) {
    this.logger.debug('Attempting to backfill Plex user');
    const result = await Result.attemptAsync(async () => {
      const userResult = await client.getUser();
      if (userResult.isFailure()) {
        throw userResult.error;
      }

      const user = userResult.get();

      await this.mediaSourceDB.setMediaSourceUserInfo(mediaSourceId, {
        userId: user.id?.toString(),
        username: user.username,
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
