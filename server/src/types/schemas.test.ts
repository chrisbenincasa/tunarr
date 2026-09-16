import { describe, expect, test } from 'vitest';
import z from 'zod/v4';
import { TruthyQueryParam } from './schemas.ts';

describe('TruthyQueryParam', () => {
  /**
   * The bug this replaced. `z.coerce.boolean()` is `Boolean(value)`, and every
   * non-empty string is truthy, so a parameter declared that way could never be
   * turned off — `?flag=false` read as true with no validation error to show
   * for it.
   */
  test.each(['false', '0'])(
    'z.coerce.boolean() would wrongly read %s as true',
    (value) => {
      expect(z.coerce.boolean().parse(value)).toBe(true);

      expect(TruthyQueryParam.parse(value)).not.toBe(true);
    },
  );

  test('a union branch after z.coerce.boolean() is unreachable', () => {
    // The previous fix attempt was `z.coerce.boolean().or(z.stringbool())`.
    // z.coerce.boolean() never fails, so the second branch never runs and the
    // parameter stayed broken.
    const neverFails = z.coerce.boolean().or(z.stringbool());

    expect(neverFails.parse('false')).toBe(true);
  });

  test.each([
    ['true', true],
    ['false', false],
    ['1', true],
    ['0', false],
    [true, true],
    [false, false],
    // A bare "?flag" arrives as the empty string, which coerces to 0.
    ['', false],
  ])('parses %s as %s', (input, expected) => {
    expect(TruthyQueryParam.parse(input)).toBe(expected);
  });

  /**
   * The `z.coerce.number()` branch accepts any numeric, but the transform then
   * compared strictly against 1, so every other number read as false. That is
   * the same failure this schema exists to prevent, one union branch over:
   * `?background=2` ran the task in the background with no validation error.
   */
  test.each([
    ['2', true],
    ['10', true],
    ['-1', true],
    ['0.5', true],
    [2, true],
    [-1, true],
  ])('parses the non-1 number %s as %s', (input, expected) => {
    expect(TruthyQueryParam.parse(input)).toBe(expected);
  });

  test.each(['0', '', ' ', 0, -0])(
    'parses the zero-valued %s as false',
    (input) => {
      expect(TruthyQueryParam.parse(input)).toBe(false);
    },
  );

  test.each(['abc', 'maybe', 'no', 'yes', {}])('rejects %s', (input) => {
    expect(() => TruthyQueryParam.parse(input)).toThrow();
  });
});
