import { isUndefined } from 'lodash-es';
import NodeCache from 'node-cache';

export async function cacheGetOrSet<T = unknown>(
  cache: NodeCache,
  key: string,
  cacheFill: () => Promise<T>,
): Promise<T> {
  let res = cache.get<T>(key);
  if (isUndefined(res)) {
    res = await cacheFill();
    cache.set(key, res);
  }
  return res;
}
