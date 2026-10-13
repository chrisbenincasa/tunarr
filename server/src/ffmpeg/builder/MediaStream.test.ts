import { VideoStream } from '@/ffmpeg/builder/MediaStream.js';
import {
  PixelFormatYuv420P,
  PixelFormatYuv420P10Le,
} from '@/ffmpeg/builder/format/PixelFormat.js';
import { FrameSize } from '@/ffmpeg/builder/types.js';

describe('MediaStream', () => {
  function createStream(
    width: number,
    height: number,
    providedSampleAspectRatio: string | null,
    displayAspectRatio: string,
  ) {
    return VideoStream.create({
      codec: 'h264',
      frameSize: FrameSize.withDimensions(width, height),
      index: 0,
      providedSampleAspectRatio,
      displayAspectRatio,
      pixelFormat: new PixelFormatYuv420P(),
    });
  }

  test('squarePixelFrameSize @ FHD with decimal DAR', () => {
    const stream = createStream(720, 480, null, '1.33');

    expect(stream.squarePixelFrameSize(FrameSize.FHD)).toMatchFrameSize(
      FrameSize.withDimensions(1436, 1080),
    );
  });

  test('derives sampleAspectRatio with decimal DAR', () => {
    const stream = createStream(720, 480, '0:0', '1.33');

    expect(stream.isAnamorphic).toBeTruthy();
    expect(stream.sampleAspectRatio).toEqual(
      `${(1.33).toFixed(12)}:${(1.5).toFixed(12)}`,
    );
  });

  test('derives sampleAspectRatio with ratio DAR', () => {
    const stream = createStream(720, 480, '0:0', '16:9');

    expect(stream.isAnamorphic).toBeTruthy();
    expect(stream.sampleAspectRatio).toEqual(
      `${(16 / 9).toFixed(12)}:${(1.5).toFixed(12)}`,
    );
  });

  test.each([
    ['0:0', '16:9', 1920, 1080],
    ['0:0', '4:3', 1440, 1080],
    ['0:1', '16:9', 1920, 1080],
    ['', '16:9', 1920, 1080],
    [null, '16:9', 1920, 1080],
    ['32:27', '16:9', 1920, 1080],
    ['8:9', '4:3', 1440, 1080],
  ])(
    '720x480 with SAR %s and DAR %s scales to %dx%d',
    (sar, dar, width, height) => {
      const stream = createStream(720, 480, sar, dar);

      expect(stream.isAnamorphic).toBe(true);
      expect(stream.squarePixelFrameSize(FrameSize.FHD)).toMatchFrameSize(
        FrameSize.withDimensions(width, height),
      );
    },
  );

  test.each([
    [1920, 1080, null, '16:9'],
    [1920, 1080, '1:1', '16:9'],
    [1920, 1080, '0:0', '1.78'],
    [1280, 720, null, '16:9'],
    [720, 480, null, ''],
  ])('%dx%d with SAR %s and DAR %s is not anamorphic', (w, h, sar, dar) => {
    expect(createStream(w, h, sar, dar).isAnamorphic).toBe(false);
  });

  test('missing SAR and DAR keeps the storage shape', () => {
    const stream = createStream(720, 480, null, '');

    expect(stream.sampleAspectRatio).toEqual('1:1');
    expect(stream.squarePixelFrameSize(FrameSize.FHD)).toMatchFrameSize(
      FrameSize.withDimensions(1620, 1080),
    );
  });

  test('explicit SAR is reported as given', () => {
    expect(createStream(720, 480, '32:27', '16:9').sampleAspectRatio).toEqual(
      '32:27',
    );
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
