import { describe, expect, test } from 'vitest';
import { parseBound, toRangeFilterValue } from './rangeFilterValue.ts';

describe('parseBound', () => {
  test.each([
    ['', undefined],
    ['   ', undefined],
    ['abc', undefined],
    ['-', undefined],
    ['Infinity', undefined],
    ['-Infinity', undefined],
    ['0', 0],
    [' 3 ', 3],
    ['-4', -4],
    ['1.5', 1.5],
    ['1.', 1],
  ])('parses %j as %j', (text, expected) => {
    expect(parseBound(text)).toBe(expected);
  });
});

describe('toRangeFilterValue', () => {
  test('keeps finite bounds, including 0 and negatives', () => {
    expect(toRangeFilterValue([0, 10])).toEqual([0, 10]);
    expect(toRangeFilterValue([-2.5, undefined])).toEqual([-2.5, undefined]);
    expect(toRangeFilterValue([undefined, 0])).toEqual([undefined, 0]);
  });

  test.each([
    ['undefined', undefined],
    ['a string', '3'],
    ['a number', 3],
    ['an empty array', []],
    ['a one-element array', [1]],
    ['a three-element array', [1, 2, 3]],
    ['string bounds', ['1', '2']],
    ['null bounds', [null, 2]],
    ['NaN', [Number.NaN, 2]],
    ['Infinity', [1, Number.POSITIVE_INFINITY]],
  ])('treats %s as no bounds', (_, value) => {
    expect(toRangeFilterValue(value)).toEqual([undefined, undefined]);
  });
});
