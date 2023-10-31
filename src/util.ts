import { reduce } from 'lodash-es';

declare global {
  interface Array<T> {
    // async
    sequentialPromises<U>(
      fn: (item: T) => Promise<U>,
      ms?: number,
    ): Promise<Array<U>>;
  }
}

export type IsStringOrNumberValue<T, K extends keyof T> = T[K] extends
  | string
  | number
  | symbol
  ? T[K]
  : never;

export type KeysOfType<T> = keyof {
  [Key in keyof T as T[Key] extends string | number ? Key : never]: T[Key];
};

export function groupByUniq<
  T,
  K extends KeysOfType<T>,
  Key extends IsStringOrNumberValue<T, K>,
>(data: T[], member: K): Record<Key, T> {
  return reduce(
    data,
    (prev, t) => ({ ...prev, [t[member] as Key]: t }),
    {} as Record<Key, T>,
  );
}

export function groupByFunc<T, Key extends string | number | symbol>(
  data: T[],
  func: (val: T) => Key,
): Record<Key, T> {
  return reduce(
    data,
    (prev, t) => ({ ...prev, [func(t)]: t }),
    {} as Record<Key, T>,
  );
}

export function groupByUniqAndMap<
  T,
  K extends KeysOfType<T>,
  Key extends IsStringOrNumberValue<T, K>,
  Value,
>(data: T[], member: K, mapper: (val: T) => Value): Record<Key, Value> {
  return reduce(
    data,
    (prev, t) => ({ ...prev, [t[member] as Key]: mapper(t) }),
    {} as Record<Key, Value>,
  );
}

export async function sequentialPromises<T, U>(
  seq: T[],
  ms: number | undefined,
  itemFn: (item: T) => Promise<U>,
): Promise<U[]> {
  let all = await seq.reduce(
    async (prev, item) => {
      let last = await prev;

      let result = await itemFn(item);

      if (ms) {
        await wait(ms);
      }

      return [...last, result];
    },
    Promise.resolve([] as U[]),
  );

  return Promise.all(all);
}

export const wait: (ms: number) => Promise<void> = (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

Array.prototype.sequentialPromises = async function <T, U>(
  itemFn: (item: T) => Promise<U>,
  ms: number | undefined,
) {
  return sequentialPromises(this, ms, itemFn);
};
