import { AudioStream, VideoStream } from '@/ffmpeg/builder/MediaStream.ts';
import { VideoFormats } from '@/ffmpeg/builder/constants.ts';
import { PixelFormat } from '@/ffmpeg/builder/format/PixelFormat.ts';
import { AudioInputSource } from '@/ffmpeg/builder/input/AudioInputSource.ts';
import { AudioState } from '@/ffmpeg/builder/state/AudioState.ts';
import { FrameState } from '@/ffmpeg/builder/state/FrameState.ts';
import { FrameSize } from '@/ffmpeg/builder/types.ts';

describe('SoftwarePipelineBuilder', () => {
  test('build args', () => {
    const pixelFormat: PixelFormat = {
      name: 'yuv420p',
      ffmpegName: 'yuv420p',
      bitDepth: 8,
    };

    const videoStream = VideoStream.create({
      index: 1,
      codec: 'h264',
      pixelFormat,
      frameSize: FrameSize.create({ width: 640, height: 480 }),
      isAnamorphic: false,
      sampleAspectRatio: null,
      displayAspectRatio: '1:1',
    });

    const audioState = AudioState.create({
      audioEncoder: 'ac3',
      audioChannels: 2,
      audioBitrate: 192,
      audioSampleRate: 48,
      audioBufferSize: 50,
      audioDuration: 11_000,
    });

    const audioInputFile = new AudioInputSource(
      'audio',
      [AudioStream.create({ index: 2, codec: 'flac', channels: 6 })],
      audioState,
    );

    const target = FrameSize.withDimensions(1280, 720);

    const frameState = FrameState({
      scaledSize: FrameSize.withDimensions(1920, 1080),
      paddedSize: target,
      isAnamorphic: false,
      realtime: true,
      videoFormat: VideoFormats.Hevc,
    });
  });
});
