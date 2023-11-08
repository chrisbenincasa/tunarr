import { isEmpty, isUndefined, reduce } from 'lodash-es';
import { isPromise } from 'node:util/types';

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

export type KeysOfType<T, X = string | number> = keyof {
  [Key in keyof T as T[Key] extends X ? Key : never]: T[Key];
};

// export type KeyOfType<T, Key extends keyof T, Target> = keyof {
//   [K in Key as T[K] extends Target ? K : never]: T[K];
// };

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
  seq: ReadonlyArray<T>,
  ms: number | undefined,
  itemFn: (item: T) => Promise<U>,
): Promise<U[]> {
  const all = await seq.reduce(
    async (prev, item) => {
      const last = await prev;

      const result = await itemFn(item);

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

export function firstDefined(obj: object, ...args: string[]) {
  if (isEmpty(args)) {
    return new String(obj);
  }

  for (const arg of args) {
    if (!isUndefined(obj[arg])) {
      return new String(obj[arg]);
    }
  }

  return 'missing';
}

Array.prototype.sequentialPromises = async function <T, U>(
  itemFn: (item: T) => Promise<U>,
  ms: number | undefined,
) {
  return sequentialPromises(this, ms, itemFn);
};

export function time<T>(
  key: string,
  f: () => T | PromiseLike<T>,
): T | PromiseLike<T> {
  console.time(key);
  const retOrPromise = f();
  if (isPromise(retOrPromise)) {
    return (retOrPromise as Promise<T>).finally(() => {
      console.timeEnd(key);
    });
  } else {
    console.timeEnd(key);
    return retOrPromise;
  }
}
