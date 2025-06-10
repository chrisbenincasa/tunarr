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
