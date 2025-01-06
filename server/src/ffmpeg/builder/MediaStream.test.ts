import { VideoStream } from '@/ffmpeg/builder/MediaStream.ts';
import { PixelFormatYuv420P } from '@/ffmpeg/builder/format/PixelFormat.ts';
import { FrameSize } from '@/ffmpeg/builder/types.ts';

describe('MediaStream', () => {
  test('squarePixelFrameSize @ FHD', () => {
    const stream = VideoStream.create({
      codec: 'h264',
      frameSize: FrameSize.withDimensions(720, 480),
      index: 0,
      sampleAspectRatio: null,
      displayAspectRatio: '1.33',
      pixelFormat: new PixelFormatYuv420P(),
    });

    console.log(stream.squarePixelFrameSize(FrameSize.FHD));
  });
});
