import _, {
  chunk,
  compact,
  concat,
  flatMap,
  identity,
  isArray,
  isEmpty,
  isError,
  isFunction,
  isNil,
  isNull,
  isPlainObject,
  isString,
  isUndefined,
  map,
  once,
  range,
  zipWith,
} from 'lodash-es';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { format } from 'node:util';
import { isPromise } from 'node:util/types';
import { Func } from '../types/func';
import { Try } from '../types/util';

export type IsStringOrNumberValue<T, K extends keyof T> = T[K] extends
  | string
  | number
  | symbol
  ? T[K]
  : never;

export type KeysOfType<T, X = string | number> = keyof {
  [Key in keyof T as T[Key] extends X ? Key : never]: T[Key];
};

export function mapToObj<T, U, O extends Record<string | number, U>>(
  data: T[],
  mapper: (x: T) => O,
): O {
  return data
    .map(mapper)
    .reduce((prev, curr) => ({ ...prev, ...curr }), {} as O);
}

// Last wins - could add an option, but generally this should
// only be used when the array is known to be unique
export function groupByUniq<
  T,
  K extends KeysOfType<T>,
  Key extends IsStringOrNumberValue<T, K>,
>(data: T[], member: K): Record<Key, T> {
  const out: Record<Key, T> = {} as Record<Key, T>;
  for (const t of data) {
    out[t[member] as Key] = t;
  }
  return out;
}

export function groupByUniqFunc<T, Key extends string | number>(
  data: T[],
  func: (item: T) => Key,
): Record<Key, T> {
  const out: Record<Key, T> = {} as Record<Key, T>;
  for (const t of data) {
    out[func(t)] = t;
  }
  return out;
}

export function groupByFunc<T, Key extends string | number | symbol, Value>(
  data: T[],
  func: (val: T) => Key,
  mapper: (val: T) => Value = identity,
): Record<Key, Value> {
  const out: Record<Key, Value> = {} as Record<Key, Value>;
  for (const t of data) {
    out[func(t)] = mapper(t);
  }
  return out;
}

export function groupByUniqAndMap<
  T,
  K extends KeysOfType<T>,
  Key extends IsStringOrNumberValue<T, K>,
  Value,
>(
  data: T[],
  member: K | ((item: T) => K),
  mapper: (val: T) => Value,
): Record<Key, Value> {
  const out: Record<Key, Value> = {} as Record<Key, Value>;
  for (const t of data) {
    out[t[isFunction(member) ? member(t) : member] as Key] = mapper(t);
  }
  return out;
}

// This will fail if any mapping function fails
export function groupByUniqAndMapAsync<
  T,
  K extends KeysOfType<T>,
  Key extends IsStringOrNumberValue<T, K>,
  Value,
>(
  data: T[],
  member: K | ((item: T) => K),
  mapper: (val: T) => Promise<Value>,
  opts?: mapAsyncSeq2Opts,
): Promise<Record<Key, Value>> {
  const keyFunc = (t: T) => t[isFunction(member) ? member(t) : member] as Key;
  return mapReduceAsyncSeq(
    data,
    (t) => mapper(t).then((v) => [keyFunc(t), v] as const),
    (acc, [key, value]) => {
      return {
        ...acc,
        [key]: value,
      };
    },
    {} as Record<Key, Value>,
    opts,
  );
}

export function groupByAndMapAsync<
  T,
  Key extends string | number | symbol,
  Value,
>(
  data: T[] | null | undefined,
  func: (val: T) => Key,
  mapper: (val: T) => Promise<Value>,
  opts?: mapAsyncSeq2Opts,
) {
  return mapReduceAsyncSeq(
    data,
    (t) => mapper(t).then((v) => [func(t), v] as const),
    (acc, [key, value]) => ({ ...acc, [key]: value }),
    {} as Record<Key, Value>,
    opts,
  );
}

type mapAsyncSeq2Opts = {
  ms?: number;
  parallelism?: number;
  failuresToNull?: boolean;
};

export async function mapReduceAsyncSeq<T, U, Res = U>(
  seq: T[] | null | undefined,
  fn: (item: T) => Promise<U>,
  reducer: (res: Res, item: U) => Res,
  empty?: Res,
  opts?: mapAsyncSeq2Opts,
): Promise<Res> {
  return (await mapAsyncSeq(seq, fn, opts)).reduce(
    reducer,
    empty ?? ([] as Res),
  );
}

export async function mapAsyncSeq<T, U>(
  seq: T[] | null | undefined,
  fn: (item: T) => Promise<U>,
  opts?: mapAsyncSeq2Opts,
): Promise<U[]> {
  if (isNil(seq)) {
    return [];
  }

  const parallelism = opts?.parallelism ?? 1;
  const results: U[] = [];
  for (const itemChunk of chunk(seq, parallelism)) {
    const promises = map(itemChunk, (item) => {
      return fn(item).catch((err) => {
        if (opts?.failuresToNull) {
          return null;
        } else {
          throw err;
        }
      });
    });
    const result = await Promise.all(promises);
    if (opts?.ms && opts.ms >= 0) {
      await wait(opts.ms);
    }
    results.push(...compact(result));
  }
  return results;
}

export async function flatMapAsyncSeq<T, U>(
  seq: T[] | null | undefined,
  itemFn: (item: T) => Promise<U[]>,
  opts?: mapAsyncSeq2Opts,
): Promise<U[]> {
  return mapReduceAsyncSeq(
    seq,
    itemFn,
    (prev, next) => {
      if (isNil(next)) {
        return prev;
      } else {
        return concat(prev, next);
      }
    },
    [] as U[],
    opts,
  );
}

export const wait: (ms?: number) => Promise<void> = (ms: number) => {
  if (isUndefined(ms)) {
    return new Promise((resolve) => setImmediate(resolve));
  }
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export function firstDefined(obj: object, ...args: string[]): string {
  if (isEmpty(args)) {
    return String(obj);
  }

  for (const arg of args) {
    if (!isUndefined(obj[arg])) {
      return String(obj[arg]);
    }
  }

  return 'missing';
}

type NativeFuncOrApply<In, Out> = ((input: In) => Out) | Func<In, Out>;

export async function asyncFlow<T>(
  ops: NativeFuncOrApply<T, Promise<T>>[],
  initial: T,
): Promise<T> {
  let res: T = initial;
  for (const op of ops) {
    res = await (isFunction(op) ? op(res) : op.apply(res));
  }
  return res;
}

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

  return _.chain(value)
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

export function attemptSync<T>(f: () => T): Try<T> {
  try {
    return f();
  } catch (e) {
    if (isError(e)) {
      return e;
    } else if (isString(e)) {
      return new Error(e);
    }

    return new Error(format('Unknown error thrown: %O', e));
  }
}

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

export function emptyStringToUndefined(
  s: string | undefined,
): string | undefined {
  if (isUndefined(s)) {
    return s;
  }

  return s.length === 0 ? undefined : s;
}

export function isNonEmptyString(v: unknown): v is string {
  return isString(v) && !isEmpty(v);
}

export function ifDefined<T, U>(
  v: T | null | undefined,
  f: (t: T) => U,
): U | null {
  if (isNil(v)) {
    return null;
  }
  return f(v);
}

export function flipMap<K extends string | number, V extends string | number>(
  m: Record<K, Iterable<V>>,
): Record<V, K> {
  const acc: Record<V, K> = {} as Record<V, K>;
  for (const [key, vs] of Object.entries<Iterable<V>>(m)) {
    for (const v of vs) {
      acc[v] = key as K;
    }
  }

  return acc;
}

export const filename = (path: string) => fileURLToPath(path);

export const currentEnv = once(() => {
  const env = process.env['NODE_ENV'];
  return env ?? 'production';
});

export const isProduction = currentEnv() === 'production';
export const isDev = currentEnv() === 'development';
export const isTest = currentEnv() === 'test';
export const isEdgeBuild = process.env['TUNARR_EDGE_BUILD'] === 'true';
export const tunarrBuild = process.env['TUNARR_BUILD'];

export const zipWithIndex = <T>(
  seq: readonly T[],
  start: number = 0,
): [T, number][] => {
  return zipWith(seq, range(start, seq.length), (s, i) => [s, i]);
};

export function scale(
  coll: readonly number[] | null | undefined,
  factor: number,
): number[] {
  return map(coll, (c) => c * factor);
}

export function run<T>(f: () => T): T {
  return f();
}

// If makeLast == true, value will be inserted on a one-element array
// If makeLast == false, value will only be inserted in between 2 array values
export function intersperse<T>(
  arr: T[],
  v: T[],
  makeLast: boolean = false,
): T[] {
  return flatMap(arr, (x, i) => (i === 0 && !makeLast ? [x] : [x, ...v]));
}

export function isSuccess<T>(x: Try<T>): x is T {
  return !isError(x);
}

export function isDefined<T>(x: T | undefined): x is T {
  return !isUndefined(x);
}

export function nullToUndefined<T>(x: T | null | undefined): T | undefined {
  if (isNull(x)) {
    return undefined;
  }
  return x;
}
