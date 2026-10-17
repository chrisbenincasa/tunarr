import {
  DefaultTonemapPeakNits,
  toFfmpegTonemapPeak,
} from '@/ffmpeg/builder/options/KnownFfmpegOptions.js';

describe('toFfmpegTonemapPeak', () => {
  test('converts nits to multiples of 100-nit reference white', () => {
    expect(toFfmpegTonemapPeak(100)).to.eq(1);
    expect(toFfmpegTonemapPeak(1000)).to.eq(10);
    expect(toFfmpegTonemapPeak(4000)).to.eq(40);
    expect(toFfmpegTonemapPeak(10000)).to.eq(100);
  });

  test('default peak of 1000 nits maps to ffmpeg peak 10', () => {
    expect(toFfmpegTonemapPeak(DefaultTonemapPeakNits)).to.eq(10);
  });
});
