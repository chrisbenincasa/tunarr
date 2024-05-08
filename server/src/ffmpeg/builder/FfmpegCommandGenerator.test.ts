import { FfmpegCommandGenerator } from './FfmpegCommandGenerator';
import { AudioStream, StillImageStream, VideoStream } from './MediaStream';
import { VideoFormats } from './constants';
import { PipelineBuilderFactory } from './pipeline/PipelineBuilderFactory';
import { AudioState } from './state/AudioState';
import { FfmpegState } from './state/FfmpegState';
import { FrameState } from './state/FrameState';
import {
  AudioInputSource,
  FrameSize,
  VideoInputSource,
  WatermarkInputSource,
} from './types';
import { PixelFormat, PixelFormatYuv420P } from './format/PixelFormat';

describe('FfmpegCommandGenerator', () => {
  test('args', () => {
    const pixelFormat: PixelFormat = new PixelFormatYuv420P();

    const videoStream = VideoStream.create({
      index: 0,
      codec: VideoFormats.H264,
      pixelFormat,
      frameSize: FrameSize.create({ width: 640, height: 480 }),
      isAnamorphic: false,
      pixelAspectRatio: null,
    });

    const audioState = AudioState.create({
      audioEncoder: 'ac3',
      audioChannels: 2,
      audioBitrate: 192,
      audioSampleRate: 48,
      audioBufferSize: 50,
      audioDuration: 11_000,
    });

    const target = FrameSize.withDimensions(1280, 720);

    const desiredState = new FrameState({
      scaledSize: videoStream.squarePixelFrameSize(target),
      paddedSize: FrameSize.withDimensions(1280, 720),
      isAnamorphic: false,
      realtime: true,
      videoFormat: VideoFormats.H264,
      frameRate: 20,
      videoBitrate: 30_000,
      interlaced: true,
    });

    const generator = new FfmpegCommandGenerator();

    const videoInputFile = new VideoInputSource(
      'https://192-168-0-154.e381701a32034bfdb5e2650ff7248a45.plex.direct:32400/library/parts/29136/1662060068/file.mkv?X-Plex-Token=jYWk_2udyfr8yAK_C3vR',
      [videoStream],
    );

    const audioInputFile = new AudioInputSource(
      videoInputFile.path,
      [AudioStream.create({ index: 1, codec: 'flac', channels: 6 })],
      audioState,
    );

    const watermarkInputFile = new WatermarkInputSource(
      'http://localhost:8000/images/tunarr.png',
      StillImageStream.create({
        index: 0,
        frameSize: FrameSize.create({ width: 19, height: -1 }),
      }),
      {
        duration: 0,
        enabled: true,
        horizontalMargin: 10,
        verticalMargin: 10,
        position: 'bottom-right',
        width: 19,
      },
    );

    const builder = PipelineBuilderFactory.builder()
      .setHardwareAccelerationMode('nvenc')
      .setVideoInputSource(videoInputFile)
      .setAudioInputSource(audioInputFile)
      .setWatermarkInputSource(watermarkInputFile)
      .build();

    const steps = builder.build(
      FfmpegState.defaultWithVersion('4.3.1'),
      desiredState,
    );

    const result = generator.generateArgs(
      videoInputFile,
      audioInputFile,
      watermarkInputFile,
      steps,
    );

    console.log(result.join(' '));
  });
});
