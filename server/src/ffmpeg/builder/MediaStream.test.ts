import { VideoStream } from '@/ffmpeg/builder/MediaStream.js';
import {
  PixelFormatYuv420P,
  PixelFormatYuv420P10Le,
} from '@/ffmpeg/builder/format/PixelFormat.js';
import { FrameSize } from '@/ffmpeg/builder/types.js';

describe('MediaStream', () => {
  test('squarePixelFrameSize @ FHD', () => {
    const stream = VideoStream.create({
      codec: 'h264',
      frameSize: FrameSize.withDimensions(720, 480),
      index: 0,
      providedSampleAspectRatio: null,
      displayAspectRatio: '1.33',
      pixelFormat: new PixelFormatYuv420P(),
    });

    expect(stream.squarePixelFrameSize(FrameSize.FHD)).toMatchFrameSize(
      FrameSize.withDimensions(1621, 1080),
    );
  });

  test('derives sampleAspectRatio with decimal DAR', () => {
    const stream = VideoStream.create({
      codec: 'h264',
      frameSize: FrameSize.withDimensions(720, 480),
      index: 0,
      providedSampleAspectRatio: '0:0',
      displayAspectRatio: '1.33',
      pixelFormat: new PixelFormatYuv420P(),
    });

    expect(stream.isAnamorphic).toBeTruthy();
    expect(stream.sampleAspectRatio).toEqual(
      `${(1.33).toFixed(12)}:${(1.5).toFixed(12)}`,
    );
  });

  test('derives sampleAspectRatio with ratio DAR', () => {
    const stream = VideoStream.create({
      codec: 'h264',
      frameSize: FrameSize.withDimensions(720, 480),
      index: 0,
      providedSampleAspectRatio: '0:0',
      displayAspectRatio: '16:9',
      pixelFormat: new PixelFormatYuv420P(),
    });

    expect(stream.isAnamorphic).toBeTruthy();
    expect(stream.sampleAspectRatio).toEqual(`16:${(1.5).toFixed(12)}`);
  });
});

describe('VideoStream.isDolbyVision', () => {
  function createStream(codec: string, profile?: string) {
    return VideoStream.create({
      codec,
      profile,
      frameSize: FrameSize.FHD,
      index: 0,
      providedSampleAspectRatio: null,
      displayAspectRatio: '16:9',
      pixelFormat: new PixelFormatYuv420P10Le(),
    });
  }

  test('returns true for dvhe codec', () => {
    expect(createStream('dvhe').isDolbyVision()).toBe(true);
  });

  test('returns true for dvh1 codec', () => {
    expect(createStream('dvh1').isDolbyVision()).toBe(true);
  });

  test('returns true for hevc codec with dolby vision profile string', () => {
    expect(
      createStream('hevc', 'dolby vision / hevc main 10').isDolbyVision(),
    ).toBe(true);
  });

  test('returns true for hevc codec with mixed-case dolby vision profile', () => {
    expect(createStream('hevc', 'Dolby Vision Profile 5').isDolbyVision()).toBe(
      true,
    );
  });

  test('returns false for hevc codec with non-DV profile', () => {
    expect(createStream('hevc', 'main 10').isDolbyVision()).toBe(false);
  });

  test('returns false for hevc codec with no profile', () => {
    expect(createStream('hevc').isDolbyVision()).toBe(false);
  });

  test('returns false for h264 codec', () => {
    expect(createStream('h264').isDolbyVision()).toBe(false);
  });
});
