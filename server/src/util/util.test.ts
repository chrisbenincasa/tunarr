import { describe, expect, test } from 'vitest';
import { gcd, mapAsyncSeq } from './index.js';

describe('utils', () => {
  test('mapAsyncSeq2', async () => {
    const result = await mapAsyncSeq([1, 2, 3, 4], async (x) => x * 2);
    console.log(result);
    expect(result).toEqual([2, 4, 6, 8]);
  });
});

describe('gcd', () => {
  test.each([
    [12, 18, 6],
    [18, 12, 6],
    [-12, 18, 6],
    [1920, 1080, 120],
    [7, 0, 7],
    [0, 7, 7],
    [0, 0, 0],
  ])('gcd(%d, %d) = %d', (a, b, expected) => {
    expect(gcd(a, b)).toBe(expected);
  });

  test.each([
    [NaN, 4],
    [4, NaN],
    [Infinity, 4],
  ])('gcd(%d, %d) is NaN', (a, b) => {
    expect(gcd(a, b)).toBeNaN();
  });
});
