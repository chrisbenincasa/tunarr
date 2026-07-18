import { describe, expect, it } from 'vitest';
import { WatermarkScaleFilter } from '@/ffmpeg/builder/filter/watermark/WatermarkScaleFilter.js';
import type { FrameSize } from '@/ffmpeg/builder/types.js';
import type { Watermark } from '@tunarr/types';

function makeWatermark(overrides: Partial<Watermark> = {}): Watermark {
  return {
    enabled: true,
    position: 'bottom-right',
    width: 10,
    verticalMargin: 1,
    horizontalMargin: 1,
    duration: 0,
    opacity: 100,
    ...overrides,
  } as Watermark;
}

describe('WatermarkScaleFilter', () => {
  it('should return scale filter with width and force even height calculation (-2)', () => {
    const resolution: FrameSize = { width: 1920, height: 1080 };
    const watermark = makeWatermark({ width: 10 });

    const filter = new WatermarkScaleFilter(resolution, watermark);

    // width = round(10% of 1920) = 192
    expect(filter.filter).toBe('scale=192:-2');
  });

  it('computes width as a percentage of the target resolution', () => {
    const resolution: FrameSize = { width: 1280, height: 720 };
    const watermark = makeWatermark({ width: 25 });

    const filter = new WatermarkScaleFilter(resolution, watermark);

    // width = round(25% of 1280) = 320
    expect(filter.filter).toBe('scale=320:-2');
  });
});
