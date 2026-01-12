import { FileStreamSource } from '../../../stream/types.ts';
import { EmptyFfmpegCapabilities } from '../capabilities/FfmpegCapabilities.ts';
import { AudioVolumeFilter } from '../filter/AudioVolumeFilter.ts';
import { PixelFormatYuv420P } from '../format/PixelFormat.ts';
import { AudioInputSource } from '../input/AudioInputSource.ts';
import { VideoInputSource } from '../input/VideoInputSource.ts';
import { AudioStream, VideoStream } from '../MediaStream.ts';
import { AudioState } from '../state/AudioState.ts';
import { DefaultPipelineOptions, FfmpegState } from '../state/FfmpegState.ts';
import { FrameState } from '../state/FrameState.ts';
import { FrameSize } from '../types.ts';
import { BasePipelineBuilder } from './BasePipelineBuilder.ts';

class NoopPipelineBuilder extends BasePipelineBuilder {
  protected setupVideoFilters(): void {}
}

describe('BasePipelineBuilder', () => {
  const audio = AudioInputSource.withStream(
    new FileStreamSource('/path/to/song.flac'),
    AudioStream.create({
      channels: 2,
      codec: 'flac',
      index: 0,
    }),
    AudioState.create({
      audioBitrate: 192,
      audioBufferSize: 192 * 2,
      audioChannels: 2,
      audioVolume: 150,
    }),
  );

  const video = VideoInputSource.withStream(
    new FileStreamSource('/path/to/video.mkv'),
    VideoStream.create({
      codec: 'h264',
      displayAspectRatio: '16:9',
      frameSize: FrameSize.withDimensions(1920, 900),
      index: 0,
      pixelFormat: new PixelFormatYuv420P(),
      providedSampleAspectRatio: null,
    }),
  );

  const state = FfmpegState.create({
    version: {
      versionString: 'n7.0.2-15-g0458a86656-20240904',
      majorVersion: 7,
      minorVersion: 0,
      patchVersion: 2,
      isUnknown: false,
    },
  });

  const frameState = new FrameState({
    isAnamorphic: false,
    paddedSize: FrameSize.FHD,
    scaledSize: FrameSize.FHD,
  });

  test('set audio volume filter', () => {
    const audio = AudioInputSource.withStream(
      new FileStreamSource('/path/to/song.flac'),
      AudioStream.create({
        channels: 2,
        codec: 'flac',
        index: 0,
      }),
      AudioState.create({
        audioBitrate: 192,
        audioBufferSize: 192 * 2,
        audioChannels: 2,
        audioVolume: 150,
      }),
    );

    const pipeline = new NoopPipelineBuilder(
      video,
      audio,
      null,
      null,
      null,
      EmptyFfmpegCapabilities,
    );

    const result = pipeline.build(state, frameState, DefaultPipelineOptions);

    const volumeFilter = result.inputs.audioInput?.filterSteps.find(
      (step) => step instanceof AudioVolumeFilter,
    );

    expect(volumeFilter).toBeDefined();
    expect(volumeFilter?.filter).toEqual(`volume=1.500`);
  });

  test('ignore invalid audio volume filter', () => {
    const audio = AudioInputSource.withStream(
      new FileStreamSource('/path/to/song.flac'),
      AudioStream.create({
        channels: 2,
        codec: 'flac',
        index: 0,
      }),
      AudioState.create({
        audioBitrate: 192,
        audioBufferSize: 192 * 2,
        audioChannels: 2,
        audioVolume: -100,
      }),
    );

    const pipeline = new NoopPipelineBuilder(
      video,
      audio,
      null,
      null,
      null,
      EmptyFfmpegCapabilities,
    );

    const result = pipeline.build(state, frameState, DefaultPipelineOptions);

    const volumeFilter = result.inputs.audioInput?.filterSteps.find(
      (step) => step instanceof AudioVolumeFilter,
    );

    expect(volumeFilter).toBeUndefined();
  });
});
