import type { Func } from '@/types/func.js';
import type { MarkNonNullable, Maybe, Nilable, Try } from '@/types/util.js';
import { createExternalId } from '@tunarr/shared';
import dayjs from 'dayjs';
import type { Duration } from 'dayjs/plugin/duration.js';
import duration from 'dayjs/plugin/duration.js';
import {
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
  keys,
  map,
  once,
  range,
  reduce,
  reject,
  trim,
  zipWith,
} from 'lodash-es';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { format, inspect } from 'node:util';
import { isPromise } from 'node:util/types';
import type { DeepReadonly, DeepWritable, NonEmptyArray } from 'ts-essentials';
import type { NewProgramDao, ProgramDao } from '../db/schema/Program.ts';

dayjs.extend(duration);

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
export function groupByUniqProp<
  T,
  K extends KeysOfType<T>,
  Key extends IsStringOrNumberValue<T, K>,
>(data: T[], member: K): Record<Key, T> {
  return groupByUniqAndMap(data, member);
}

export function groupByUniqAndMap<
  T,
  K extends KeysOfType<T>,
  Key extends IsStringOrNumberValue<T, K>,
  Value,
>(
  data: T[],
  member: K | ((item: T) => Key),
  mapper: (val: T) => Value = identity,
): Record<Key, Value> {
  const out: Record<Key, Value> = {} as Record<Key, Value>;
  for (const t of data) {
    const key = isFunction(member) ? member(t) : t[member];
    out[key] = mapper(t);
  }
  return out;
}

// This will fail if any mapping function fails
export function groupByUniqPropAndMapAsync<
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

export function groupByUniq<T, Key extends string | number | symbol>(
  data: T[],
  func: (item: T) => Key,
): Record<Key, T> {
  return groupByFunc(data, func);
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

export function groupByTyped<T, Key extends string | number | symbol>(
  data: T[],
  grouper: (val: T) => Key,
): Record<Key, T[]> {
  const out = {} as Record<Key, T[]>;
  for (const t of data) {
    const k = grouper(t);
    out[k] ??= [];
    out[k].push(t);
  }
  return out;
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function asyncMapToRecord<T, U, K extends keyof any>(
  seq: Nilable<Array<T>>,
  mapper: (item: T) => Promise<U>,
  extractKey: (mapped: U) => K,
  opts?: mapAsyncSeq2Opts,
): Promise<Record<K, U>> {
  return mapReduceAsyncSeq(
    seq,
    mapper,
    (prev, u) => {
      prev[extractKey(u)] = u;
      return prev;
    },
    {} as Record<K, U>,
    opts,
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

export const wait = (ms?: number | Duration) => {
  if (dayjs.isDuration(ms)) {
    return new Promise((resolve) => setTimeout(resolve, ms.asMilliseconds()));
  }
  return new Promise((resolve) => setTimeout(resolve, ms ?? 0));
};

export function timeoutPromise<T>(
  promise: Promise<T>,
  ms: number | Duration,
): Promise<T> {
  ms = dayjs.isDuration(ms) ? +ms : ms;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms),
    ),
  ]);
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
    n[index] = deepCopy(element)!;
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

  return reduce(
    keys(value),
    (prev, key) => {
      return {
        ...prev,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        [key]: isArray(value[key])
          ? deepCopyArray(value[key])
          : deepCopy(value[key]),
      };
    },
    {} as T,
  );
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

export function retrySimple<T>(f: () => Nilable<T>, times: number): Nilable<T> {
  for (let i = 0; i < times; i++) {
    const res = f();
    if (res) {
      return res;
    }
  }
  return;
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
  return isString(v) && !isEmpty(trim(v));
}

export function ifDefined<T, U>(
  v: T | null | undefined,
  f: (t: T) => U,
): U | null {
  if (isNil(v)) {
    return null;
  }
  const ret = f(v);
  return isUndefined(ret) ? null : ret;
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

export function removeErrors<T>(coll: Try<T>[] | null | undefined): T[] {
  return reject(coll, isError) satisfies T[] as T[];
}

export function parseIntOrNull(s: string): number | null {
  const parsed = parseInt(s);
  return isNaN(parsed) ? null : parsed;
}

export function parseFloatOrNull(s: string): number | null {
  const parsed = parseFloat(s);
  return isNaN(parsed) ? null : parsed;
}

export function isLinux() {
  return process.platform === 'linux';
}

export function isMac() {
  return process.platform === 'darwin';
}

export function isWindows() {
  return process.platform === 'win32';
}
export function gcd(a: number, b: number) {
  a = Math.abs(a);
  b = Math.abs(b);

  if (b > a) {
    const temp = a;
    a = b;
    b = temp;
  }

  for (;;) {
    a %= b;
    if (a === 0) {
      return b;
    }
    b %= a;
    if (b === 0) {
      return a;
    }
  }
}

export function makeWritable<T>(obj: DeepReadonly<T>): DeepWritable<T> {
  return obj as DeepWritable<T>; // here be hacks
}

export function inConstArr<Arr extends readonly string[], S extends string>(
  arr: Arr,
  typ: S,
): boolean {
  for (const value of arr) {
    if (value === typ) {
      return true;
    }
  }

  return false;
}

export function isNonEmptyArray<T>(
  t: Nilable<ReadonlyArray<T> | Array<T>>,
): t is NonEmptyArray<T> {
  return t ? t.length > 0 : false;
}

export function caughtErrorToError(e: unknown): Error {
  if (isError(e)) {
    return e;
  } else if (isString(e)) {
    return new Error(e);
  } else {
    return new Error(inspect(e));
  }
}

export function inTuple<Arr extends readonly string[], S extends string>(
  arr: Arr,
  typ: S,
): boolean {
  for (const value of arr) {
    if (value === typ) {
      return true;
    }
  }

  return false;
}

export function programExternalIdString(
  p: MarkNonNullable<ProgramDao, 'mediaSourceId'> | NewProgramDao,
) {
  if (p.sourceType === 'local') {
    return p.externalKey; // This should never hit, but if it does externalKey will point to the file path.
  } else {
    return createExternalId(p.sourceType, p.mediaSourceId, p.externalKey);
  }
}

export function unzip<T, U>(tups: [T, U][]): [T[], U[]] {
  const left: T[] = [];
  const right: U[] = [];
  for (const [t, u] of tups) {
    left.push(t);
    right.push(u);
  }
  return [left, right];
}

export function firstDefined<T>(...values: Nilable<T>[]): Maybe<T> {
  for (const value of values) {
    if (value) {
      return value;
    }
  }
  return;
}

export function isHttpUrl(input: string): boolean {
  if (!URL.canParse(input)) {
    return false;
  }
  const parsed = URL.parse(input);
  return parsed?.protocol.startsWith('http') ?? false;
}
