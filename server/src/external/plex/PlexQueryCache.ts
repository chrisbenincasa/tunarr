import type { QueryResult } from '@/external/BaseApiClient.js';
import { isDefined } from '@/util/index.js';
import NodeCache from 'node-cache';

export class PlexQueryCache {
  #cache: NodeCache;
  constructor() {
    this.#cache = new NodeCache({
      useClones: false,
      deleteOnExpire: true,
      checkperiod: 60,
      maxKeys: 2500,
      stdTTL: 5 * 60 * 1000,
    });
  }

  async getOrSet<T>(
    serverName: string,
    path: string,
    getter: () => Promise<T>,
  ): Promise<T> {
    const key = this.getCacheKey(serverName, path);
    const existing = this.#cache.get<T>(key);
    if (isDefined(existing)) {
      return existing;
    }

    const value = await getter();
    this.#cache.set(key, value);
    return value;
  }

  async getOrSetPlexResult<T>(
    serverName: string,
    path: string,
    getter: () => Promise<QueryResult<T>>,
    opts?: { setOnError: boolean },
  ): Promise<QueryResult<T>> {
    const key = this.getCacheKey(serverName, path);
    const existing = this.#cache.get<QueryResult<T>>(key);
    if (isDefined(existing)) {
      return existing;
    }

    const value = await getter();
    if (value.isSuccess() || opts?.setOnError) {
      this.#cache.set(key, value);
    }

    return value;
  }

  private getCacheKey(serverName: string, path: string) {
    return `${serverName}|${path}`;
  }
}
