import { forEach } from 'lodash-es';
import type { Nilable } from '../types/util.ts';

// Basically uniqWith + map in one show.
// U must be able to be compared by value
export function uniqProperties<T, U>(
  arr: Nilable<T[]>,
  mapper: (t: T) => U,
): U[] {
  if (!arr) {
    return [];
  }

  const set = new Set<U>();
  for (const t of arr) {
    const u = mapper(t);
    if (!set.has(u)) {
      set.add(u);
    }
  }
  return [...set];
}
export function flipMap<K extends string, V, K2 extends PropertyKey>(
  inMap: Record<K, Array<V>>,
  mapper: (v: V) => K2,
): Record<K2, K[]> {
  const outMap = {} as Record<K2, K[]>;
  forEach(inMap, (values, key) => {
    for (const value of values) {
      const key2 = mapper(value);
      const existing = (outMap[key2] ?? []) as K[];
      existing.push(key as K);
      outMap[key2] = existing;
    }
  });
  return outMap;
}

export function filterValues<K extends PropertyKey, V, Narrowed extends V>(
  inMap: Record<K, Array<V>>,
  filter: (v: V) => v is Narrowed,
): Record<K, Array<Narrowed>>;
export function filterValues<K extends PropertyKey, V>(
  inMap: Record<K, Array<V>>,
  filter: (v: V) => boolean,
): Record<K, Array<V>> {
  const out = {} as Record<K, Array<V>>;
  for (const [key, val] of Object.entries<Array<V>>(inMap)) {
    out[key] = val.filter(filter);
  }
  return out;
}
