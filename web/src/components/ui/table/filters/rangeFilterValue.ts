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
