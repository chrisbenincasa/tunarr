import { VideoStream } from '@/ffmpeg/builder/MediaStream.js';
import { PixelFormatYuv420P } from '@/ffmpeg/builder/format/PixelFormat.js';
import { FrameSize } from '@/ffmpeg/builder/types.js';

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
