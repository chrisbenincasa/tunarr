import { describe, expect, test } from 'vitest';
import { mapAsyncSeq2 } from './util';

describe('utils', () => {
  test('mapAsyncSeq2', async () => {
    const result = await mapAsyncSeq2([1, 2, 3, 4], async (x) => x * 2);
    console.log(result);
    expect(result).toEqual([2, 4, 6, 8]);
  });
});
