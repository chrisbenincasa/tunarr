import { AudioStream, VideoStream } from '@/ffmpeg/builder/MediaStream.ts';
import { VideoFormats } from '@/ffmpeg/builder/constants.ts';
import { PixelFormatYuv420P } from '@/ffmpeg/builder/format/PixelFormat.ts';
import { AudioInputSource } from '@/ffmpeg/builder/input/AudioInputSource.ts';
import { AudioState } from '@/ffmpeg/builder/state/AudioState.ts';
import { FrameState } from '@/ffmpeg/builder/state/FrameState.ts';
import { FrameSize } from '@/ffmpeg/builder/types.ts';
import { FileStreamSource } from '@/stream/types.ts';

describe('SoftwarePipelineBuilder', () => {
  test('build args', () => {
    const videoStream = VideoStream.create({
      index: 1,
      codec: 'h264',
      pixelFormat: new PixelFormatYuv420P(),
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

    const audioInputFile = new AudioInputSource(
      new FileStreamSource('audio_path'),
      [AudioStream.create({ index: 2, codec: 'flac', channels: 6 })],
      audioState,
    );

    const target = FrameSize.withDimensions(1280, 720);

    const frameState = new FrameState({
      scaledSize: FrameSize.withDimensions(1920, 1080),
      paddedSize: target,
      isAnamorphic: false,
      realtime: true,
      videoFormat: VideoFormats.Hevc,
    });
  });
});
