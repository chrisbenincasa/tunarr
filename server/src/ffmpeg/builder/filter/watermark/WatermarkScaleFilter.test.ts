import { describe, expect, test } from 'vitest';
import { WatermarkScaleFilter } from './WatermarkScaleFilter';

describe('WatermarkScaleFilter', () => {
  test('should return scale filter with width and force even height calculation (-2)', () => {
    const width = 192;
    const filter = new WatermarkScaleFilter(width);

    const result = filter.build();

    expect(result).toBe(`scale=${width}:-2`);
  });
});
