import { FfmpegCommandGenerator } from './FfmpegCommandGenerator';
import { AudioStream, VideoStream } from './MediaStream';
import { VideoFormats } from './constants';
import { PipelineBuilderFactory } from './pipeline/PipelineBuilderFactory';
import { AudioState } from './state/AudioState';
import { FfmpegState } from './state/FfmpegState';
import { FrameState } from './state/FrameState';
import {
  AudioInputFile,
  FrameSize,
  PixelFormat,
  VideoInputFile,
} from './types';

describe('FfmpegCommandGenerator', () => {
  test('args', () => {
    const pixelFormat: PixelFormat = {
      name: 'yuv420p',
      ffmpegName: 'yuv420p',
      bitDepth: 8,
    };

    const videoStream = VideoStream.create({
      index: 1,
      codec: VideoFormats.H264,
      pixelFormat,
      frameSize: FrameSize.create({ width: 640, height: 480 }),
      isAnamorphic: false,
      pixelAspectRatio: null,
    });

    console.log(videoStream);

    const audioState = AudioState.create({
      audioEncoder: 'ac3',
      audioChannels: 2,
      audioBitrate: 192,
      audioSampleRate: 48,
      audioBufferSize: 50,
      audioDuration: 11_000,
    });

    const audioInputFile = new AudioInputFile(
      'audio',
      [AudioStream.create({ index: 2, codec: 'flac', channels: 6 })],
      audioState,
    );

    const target = FrameSize.withDimensions(1280, 720);

    const desiredState = FrameState({
      scaledSize: videoStream.squarePixelFrameSize(target),
      paddedSize: FrameSize.withDimensions(1280, 720),
      isAnamorphic: false,
      realtime: true,
      videoFormat: VideoFormats.Hevc,
      frameRate: 20,
      videoBitrate: 30_000,
      interlaced: true,
    });

    const generator = new FfmpegCommandGenerator();

    const videoInputFile = new VideoInputFile('video', [videoStream]);
    const builder = PipelineBuilderFactory.getBuilder(
      'none',
      videoInputFile,
      audioInputFile,
    );

    const steps = builder.build(FfmpegState.create(), desiredState);

    const result = generator.generateArgs(videoInputFile, steps);

    console.log(result.join(' '));
  });
});
