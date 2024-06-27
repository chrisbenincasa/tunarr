import { flatMap, isFunction, isNil } from 'lodash-es';

export function intersperse<T>(arr: T[], v: T, makeLast: boolean = false): T[] {
  return flatMap(arr, (x, i) => (i === 0 && !makeLast ? [x] : [x, v]));
}

/**
 * Equivalent of compact(map()) but in a single pass on the array
 */
export function collect<T, U>(
  arr: T[] | null | undefined,
  f: (t: T) => U | null | undefined,
): U[] {
  if (isNil(arr)) {
    return [];
  }

  const func = isFunction(f) ? f : (t: T) => t[f];

  const results: U[] = [];
  for (const el of arr) {
    const res = func(el);
    if (!isNil(res)) {
      results.push(res);
    }
  }

  return results;
}
