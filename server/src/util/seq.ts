import { forEach } from 'lodash-es';
import throttle from './throttle.ts';

// K -> V => V -> K[]
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

export async function throttledLoop<T, U = void>(
  input: Array<T>,
  cb: (element: T) => Promise<U>,
  leading: boolean = true,
): Promise<void> {
  for (const element of input) {
    if (leading) await throttle();
    await cb(element);
    if (!leading) await throttle();
  }
}

export async function throttledAccumulate<T, U>(
  input: Array<T>,
  cb: (element: T) => Promise<Array<U>>,
  accFunc: (acc: Array<U>, result: Array<U>) => void = (acc, res) =>
    acc.push(...res),
): Promise<Array<U>> {
  const results: Array<U> = [];
  await throttledLoop(input, async (element) => {
    const res = await cb(element);
    accFunc(results, res);
  });
  return results;
}
