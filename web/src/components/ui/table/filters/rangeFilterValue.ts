type Bound = number | undefined;
export type RangeFilterValue = [Bound, Bound];

const isBound = (v: unknown): v is Bound =>
  v === undefined || (typeof v === 'number' && Number.isFinite(v));

export const toRangeFilterValue = (value: unknown): RangeFilterValue => {
  if (Array.isArray(value) && value.length === 2) {
    const min: unknown = value[0];
    const max: unknown = value[1];
    if (isBound(min) && isBound(max)) {
      return [min, max];
    }
  }
  return [undefined, undefined];
};

export const parseBound = (text: string): Bound => {
  const trimmed = text.trim();
  if (trimmed === '') {
    return undefined;
  }
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : undefined;
};

// Matches the table's inNumberRange filter function. Both ends are inclusive,
// a blank bound is open, and inverted bounds are swapped.
export const inRange = (value: number, filterValue: unknown) => {
  const [a, b] = toRangeFilterValue(filterValue);
  const min = a ?? Number.NEGATIVE_INFINITY;
  const max = b ?? Number.POSITIVE_INFINITY;
  return value >= Math.min(min, max) && value <= Math.max(min, max);
};
