import {
  compact,
  flatMap,
  isBoolean,
  isFunction,
  isNil,
  sortBy,
} from 'lodash-es';
import type { NonEmptyArray } from 'ts-essentials';

export function intersperse<T>(arr: T[], v: T, makeLast: boolean = false): T[] {
  return flatMap(arr, (x, i) => (i === 0 && !makeLast ? [x] : [x, v]));
}

type MapperFunc<In, Out> = (t: In, index: number, arr: In[]) => Out;
type TypePredicateFunc<In, Out extends In> = (
  t: In,
  index: number,
  arr: In[],
) => t is Out;

/**
 * Equivalent of compact(map()) but in a single pass on the array
 */
export function collect<T, U extends T>(
  arr: T[] | null | undefined,
  f: TypePredicateFunc<T, U>,
): U[];
export function collect<T, U>(
  arr: T[] | null | undefined,
  f: MapperFunc<T, U | null | undefined>,
): U[];
export function collect<
  T,
  U,
  Func extends
    | MapperFunc<T, U | null | undefined>
    | (U extends T ? TypePredicateFunc<T, U> : never),
>(arr: T[] | null | undefined, f: Func): U[] {
  if (isNil(arr)) {
    return [];
  }

  const func = isFunction(f) ? f : (t: T) => t[f];

  const results: U[] = [];
  let i = 0;
  for (const el of arr) {
    const res = func(el, i++, arr);
    if (isBoolean(res)) {
      // type predicate case
      if (res) results.push(el as unknown as U);
    } else if (!isNil(res)) {
      results.push(res);
    }
  }

  return results;
}

export async function asyncCollect<T, U>(
  arr: T[] | null | undefined,
  f: (
    t: T,
    index: number,
    arr: T[],
  ) => Promise<U | null | undefined> | null | undefined,
): Promise<U[]> {
  if (isNil(arr)) {
    return [];
  }

  const promises: Promise<U | null | undefined>[] = [];
  let i = 0;
  for (const el of arr) {
    const promise = f(el, i++, arr);
    if (promise) {
      promises.push(promise);
    }
  }
  const out = await Promise.all(promises);
  return compact(out);
}

export function collectMapValues<ValueType, ReturnType>(
  input: Record<string, ValueType> | null | undefined,
  f: (
    value: ValueType,
    key: string,
    obj: Record<string, ValueType>,
  ) => ReturnType | null | undefined,
): ReturnType[] {
  if (isNil(input)) {
    return [];
  }

  const results: ReturnType[] = [];
  for (const [key, value] of Object.entries<ValueType>(input)) {
    const res = f(value, key, input);
    if (isNil(res)) {
      continue;
    }
    results.push(res);
  }
  return results;
}

export function groupBy<T, Key extends string | number | symbol>(
  arr: NonEmptyArray<T>,
  f: (t: T) => Key,
): Record<Key, NonEmptyArray<T>>;
export function groupBy<T, Key extends string | number | symbol>(
  arr: Array<T>,
  f: (t: T) => Key,
): Record<Key, Array<T>>;
export function groupBy<T, Key extends string | number | symbol>(
  arr: T[] | NonEmptyArray<T> | null | undefined,
  f: (t: T) => Key,
): Record<Key, T[]> {
  if (isNil(arr)) {
    return {} as Record<Key, T[]>;
  }

  const ret: Record<Key, T[]> = {} as Record<Key, T[]>;

  for (const t of arr) {
    const key = f(t);
    const v = ret[key];
    if (v) {
      v.push(t);
    } else {
      ret[key] = [t];
    }
  }

  return ret;
}

export function rotateArray<T>(arr: T[], positions: number): T[] {
  return arr.slice(positions, arr.length).concat(arr.slice(0, positions));
}

export function binarySearchRange(seq: readonly number[], target: number) {
  let low = 0,
    high = seq.length - 1;
  const sorted = sortBy(seq);
  if (seq.length === 0 || target < 0 || target > sorted[seq.length - 1]) {
    return null;
  }

  while (low + 1 < high) {
    const mid = low + ((high - low) >>> 1);
    if (sorted[mid] > target) {
      high = mid;
    } else {
      low = mid;
    }
  }

  return low;
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
