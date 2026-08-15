import { WatermarkDurationFilter } from '@/ffmpeg/builder/filter/watermark/WatermarkDurationFilter.js';
import { describe, expect, it } from 'vitest';

describe('WatermarkDurationFilter', () => {
  it('trims and rebases the watermark input timeline', () => {
    expect(new WatermarkDurationFilter(5).filter).toBe(
      'trim=duration=5,setpts=PTS-STARTPTS',
    );
  });
});
