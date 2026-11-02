import { describe, expect, test } from 'vitest';
import { secondsToWholeMs } from './FfprobeStreamDetails.ts';

describe('secondsToWholeMs', () => {
  test('strips float noise from the seconds conversion', () => {
    expect(secondsToWholeMs(8.021)).toBe(8021);
  });

  test('rounds sub-millisecond precision down', () => {
    expect(secondsToWholeMs(1548.021999)).toBe(1_548_021);
  });

  test('returns integers across a range of millisecond inputs', () => {
    for (let ms = 1_000_000; ms < 1_010_000; ms++) {
      expect(secondsToWholeMs(ms / 1000)).toBe(ms);
    }
  });
});
