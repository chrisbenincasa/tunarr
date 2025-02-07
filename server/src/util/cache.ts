import { isUndefined } from 'lodash-es';
import type NodeCache from 'node-cache';

export async function cacheGetOrSet<T = unknown>(
  cache: NodeCache,
  key: string,
  cacheFill: () => Promise<T>,
  setOnUndefined: boolean = false,
): Promise<T> {
  let res = cache.get<T>(key);
  if (isUndefined(res)) {
    res = await cacheFill();
    if (res || (isUndefined(res) && setOnUndefined)) {
      cache.set(key, res);
    }
  }
  return res;
}
