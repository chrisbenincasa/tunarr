import { OverlayWatermarkVaapiFilter } from '@/ffmpeg/builder/filter/vaapi/OverlayWatermarkVaapiFilter.js';
import type { Watermark } from '@tunarr/types';
import { describe, expect, it } from 'vitest';
import { FrameSize } from '../../types.ts';

function makeWatermark(overrides: Partial<Watermark> = {}): Watermark {
  return {
    duration: 0,
    enabled: true,
    horizontalMargin: 2,
    opacity: 100,
    position: 'bottom-left',
    verticalMargin: 6,
    width: 75,
    ...overrides,
  } as Watermark;
}

describe('OverlayWatermarkVaapiFilter', () => {
  it('positions a persistent watermark without finite-duration options', () => {
    const filter = new OverlayWatermarkVaapiFilter(
      makeWatermark(),
      FrameSize.FHD,
    );

    expect(filter.filter).toBe('overlay_vaapi=x=38:y=H-h-65');
  });

  it('passes through the main video when a finite watermark input ends', () => {
    const filter = new OverlayWatermarkVaapiFilter(
      makeWatermark({ duration: 5 }),
      FrameSize.FHD,
    );

    expect(filter.filter).toBe(
      'overlay_vaapi=x=38:y=H-h-65:eof_action=pass:repeatlast=0',
    );
  });
});
