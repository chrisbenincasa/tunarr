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

  test.each(['abc', 'maybe', 'no', 'yes', {}])('rejects %s', (input) => {
    expect(() => TruthyQueryParam.parse(input)).toThrow();
  });
});
