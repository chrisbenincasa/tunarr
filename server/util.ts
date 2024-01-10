import {
  chain,
  identity,
  isArray,
  isEmpty,
  isError,
  isNil,
  isPlainObject,
  isString,
  isUndefined,
  reduce,
} from 'lodash-es';
import fs from 'fs/promises';
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

export function mapToObj<T, U, O extends Record<string | number, U>>(
  data: T[],
  mapper: (x: T) => O,
): O {
  return data
    .map(mapper)
    .reduce((prev, curr) => ({ ...prev, ...curr }), {} as O);
}

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

export function groupByUniqFunc<T, Key extends string | number>(
  data: T[],
  func: (item: T) => Key,
): Record<Key, T> {
  return reduce(
    data,
    (prev, t) => ({ ...prev, [func(t)]: t }),
    {} as Record<Key, T>,
  );
}

export function groupByFunc<T, Key extends string | number | symbol, Value>(
  data: T[],
  func: (val: T) => Key,
  mapper: (val: T) => Value = identity,
): Record<Key, Value> {
  return reduce(
    data,
    (prev, t) => ({ ...prev, [func(t)]: mapper(t) }),
    {} as Record<Key, Value>,
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

export async function mapAsyncSeq<T, U>(
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

export async function mapReduceAsyncSeq<T, U, Res>(
  seq: ReadonlyArray<T>,
  itemFn: (item: T) => Promise<U>,
  combineFn: (prev: Res, next: U) => Res,
  empty: Res,
): Promise<Res> {
  const all = await seq.reduce(
    async (prev, item) => {
      const last = await prev;

      const result = await itemFn(item);

      return [...last, result];
    },
    Promise.resolve([] as U[]),
  );

  return Promise.all(all).then((res) => res.reduce(combineFn, empty));
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
  return mapAsyncSeq(this as ReadonlyArray<T>, ms, itemFn);
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

export function deepCopyArray<T>(value: T[] | undefined): T[] | undefined {
  if (isUndefined(value)) {
    return value;
  }
  const n = Array<T>(value.length);
  for (let index = 0; index < value.length; index++) {
    const element = value[index];
    n[index] = deepCopy(element);
  }
  return n;
}

export function deepCopy<T>(value: T): T {
  if (!isPlainObject(value)) {
    return value;
  } else if (
    (typeof value !== 'object' && typeof value !== 'function') ||
    value === null
  ) {
    return value;
  }

  return chain(value)
    .keys()
    .reduce((prev, key) => {
      return {
        ...prev,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        [key]: isArray(value[key])
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            deepCopyArray(value[key] as any[])
          : deepCopy(value[key]),
      };
    }, {} as T)
    .value() as T;
}

export function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error;
}

export async function createDirectoryIfNotExists(
  dirPath: string,
): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (err) {
    if (isNodeError(err) && err.code !== 'EEXIST') {
      // Throw an error if it's not because the directory already exists
      throw err;
    }
  }
}

export type Try<T> = T | Error;
export async function attempt<T>(f: () => T | PromiseLike<T>): Promise<Try<T>> {
  try {
    const res = f();
    if (isPromise(res)) {
      return await res;
    } else {
      return res;
    }
  } catch (e) {
    if (isError(e)) {
      return e;
    } else if (isString(e)) {
      return new Error(e);
    }

    throw e; // Unhandled
  }
}

function enumKeys<O extends object, K extends keyof O = keyof O>(obj: O): K[] {
  return Object.keys(obj).filter((k) => !Number.isNaN(k)) as K[];
}

export function enumFromString<O extends object>(
  obj: O,
  str: string,
): O | undefined {
  for (const key of enumKeys(obj)) {
    const value = obj[key];
    if ((key as string).toLowerCase() === str) {
      return value as O;
    }
  }
  return;
}

export function nilToUndefined<T>(t: T | undefined | null): T | undefined {
  return isNil(t) ? undefined : t;
}
