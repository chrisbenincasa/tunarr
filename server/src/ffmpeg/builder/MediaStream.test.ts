import { VideoStream } from '@/ffmpeg/builder/MediaStream.js';
import { PixelFormatYuv420P } from '@/ffmpeg/builder/format/PixelFormat.js';
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
