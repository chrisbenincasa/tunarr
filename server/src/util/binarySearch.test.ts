import { map, range } from 'lodash-es';
import { describe, test } from 'vitest';
import { binarySearchRange } from './binarySearch.js';

describe('binarySearch', () => {
  test('find in range', () => {
    const r = range(0, 101, 10);
    console.log(map(r, (r, i) => [r, i]));
    console.log(binarySearchRange(r, 21));
  });
});
