import { describe, expect, test } from 'vitest';
import { PagingParams } from './schemas.ts';

describe('PagingParams', () => {
  /**
   * `.default(-1)` only applies to a *missing* key. `?limit=` is present but
   * empty, which `z.coerce.number()` turns into 0 — and 0 passes `.min(-1)`
   * and reaches the DB as `.limit(0)`, whereas the intended sentinel for "no
   * limit" is -1. So any client building its query as `limit=${value ?? ''}`
   * got `{total: 137, result: [], size: 0}` with a 200.
   */
  test.each(['', ' ', '   '])(
    'treats the blank limit %j as absent',
    (value) => {
      expect(PagingParams.parse({ limit: value }).limit).toBe(-1);
    },
  );

  test.each(['', ' '])('treats the blank offset %j as absent', (value) => {
    expect(PagingParams.parse({ offset: value }).offset).toBe(0);
  });

  test('defaults both when the keys are missing', () => {
    expect(PagingParams.parse({})).toEqual({ limit: -1, offset: 0 });
  });

  test.each([
    ['25', 25],
    ['0', 0],
    ['-1', -1],
  ])('still parses the limit %s as %d', (input, expected) => {
    expect(PagingParams.parse({ limit: input }).limit).toBe(expected);
  });

  test('still parses a supplied offset', () => {
    expect(PagingParams.parse({ offset: '5' }).offset).toBe(5);
  });

  /**
   * There was no `.int()`, so `?limit=1.5` reached SQL as a float. This is a
   * stricter contract than before: it now rejects rather than silently
   * passing a fraction through to the query.
   */
  test.each(['1.5', '0.1', '-2.5'])('rejects the fractional limit %s', (v) => {
    expect(() => PagingParams.parse({ limit: v })).toThrow();
  });

  test.each(['1.5', '2.7'])('rejects the fractional offset %s', (v) => {
    expect(() => PagingParams.parse({ offset: v })).toThrow();
  });

  test.each([
    { limit: '-5' },
    { offset: '-1' },
    { limit: 'abc' },
    { offset: 'abc' },
  ])('still rejects %o', (input) => {
    expect(() => PagingParams.parse(input)).toThrow();
  });
});
