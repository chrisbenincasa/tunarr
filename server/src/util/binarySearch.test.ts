import { range } from 'lodash-es';
import { describe, test } from 'vitest';
import { binarySearchRange } from './binarySearch.js';

describe('binarySearch', () => {
  test('find in range', () => {
    const r = range(0, 101, 10);
    expect(binarySearchRange(r, 21)).toEqual(2);
  });

  test('find in offset array', () => {
    // This represents a lineup with 4 programs
    // program 1 = 100 duration
    // programs 2, 3, 4 have 200 duration
    const offsets = [0, 100, 300, 500, 700];
    expect(binarySearchRange(offsets, 100)).toEqual(1);
    expect(binarySearchRange(offsets, 99)).toEqual(0);
  });

  test('out of range', () => {
    const offsets = [0, 100, 300, 500, 700];
    expect(binarySearchRange(offsets, -1)).toBe(null);
    expect(binarySearchRange(offsets, 701)).toBe(null);
  });
});
