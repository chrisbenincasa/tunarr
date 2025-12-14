import { inRange, sortBy } from 'lodash-es';

type Comparator = (
  current: number,
  target: number,
  range: { low: number; high: number },
) => number;

// Returns the index of the array where comparator matches
export function binarySearch(
  seq: readonly number[],
  target: number,
  comparator: Comparator,
  low: number = 0,
  high: number = seq.length - 1,
): number | null {
  if (!inRange(low, 0, seq.length - 1) || !inRange(high, 0, seq.length)) {
    return null;
  }

  let mid: number, cmp: number;
  while (low <= high) {
    mid = low + ((high - low) >>> 1);
    cmp = comparator(seq[mid]!, target, { low, high });
    if (cmp < 0) {
      low = mid + 1;
    } else if (cmp > 0) {
      high = mid - 1;
    } else {
      return mid;
    }
  }

  return low;
}

export function binarySearchRange(
  seq: readonly number[],
  target: number,
  isSorted: boolean = false,
) {
  let low = 0,
    high = seq.length - 1;
  const sorted = isSorted ? sortBy(seq) : seq;
  if (seq.length === 0 || target < 0 || target > sorted[seq.length - 1]!) {
    return null;
  }

  while (low + 1 < high) {
    const mid = low + ((high - low) >>> 1);
    if (sorted[mid]! > target) {
      high = mid;
    } else {
      low = mid;
    }
  }

  return low;
}
