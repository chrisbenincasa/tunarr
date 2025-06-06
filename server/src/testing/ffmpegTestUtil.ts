import { PixelFormatYuv420P } from '../ffmpeg/builder/format/PixelFormat.ts';
import { VideoStream } from '../ffmpeg/builder/MediaStream.ts';
import { FfmpegState } from '../ffmpeg/builder/state/FfmpegState.ts';
import { FrameSize } from '../ffmpeg/builder/types.ts';

export const FfmpegStateVersion702 = () =>
  FfmpegState.create({
    version: {
      versionString: 'n7.0.2-15-g0458a86656-20240904',
      majorVersion: 7,
      minorVersion: 0,
      patchVersion: 2,
      isUnknown: false,
    },
  });

export const h2641080pVideoStream = () =>
  VideoStream.create({
    codec: 'h264',
    displayAspectRatio: '16:9',
    frameSize: FrameSize.FHD,
    index: 0,
    pixelFormat: new PixelFormatYuv420P(),
    sampleAspectRatio: '1:1',
    frameRate: '23.98',
  });

export const h264FourKVideoStream = () =>
  VideoStream.create({
    codec: 'h264',
    displayAspectRatio: '16:9',
    frameSize: FrameSize.FourK,
    index: 0,
    pixelFormat: new PixelFormatYuv420P(),
    sampleAspectRatio: '1:1',
    frameRate: '23.98',
  });
