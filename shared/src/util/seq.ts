import { flatMap, isFunction, isNil } from 'lodash-es';

export function intersperse<T>(arr: T[], v: T, makeLast: boolean = false): T[] {
  return flatMap(arr, (x, i) => (i === 0 && !makeLast ? [x] : [x, v]));
}

/**
 * Equivalent of compact(map()) but in a single pass on the array
 */
export function collect<T, U>(
  arr: T[] | null | undefined,
  f: (t: T, index: number, arr: T[]) => U | null | undefined,
): U[] {
  if (isNil(arr)) {
    return [];
  }

  const func = isFunction(f) ? f : (t: T) => t[f];

  const results: U[] = [];
  let i = 0;
  for (const el of arr) {
    const res = func(el, i++, arr);
    if (!isNil(res)) {
      results.push(res);
    }
  }

  return results;
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
  arr: T[] | null | undefined,
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
