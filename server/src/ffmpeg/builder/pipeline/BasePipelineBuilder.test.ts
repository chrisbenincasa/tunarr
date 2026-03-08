import { FileStreamSource } from '../../../stream/types.ts';
import { EmptyFfmpegCapabilities } from '../capabilities/FfmpegCapabilities.ts';
import { AudioVolumeFilter } from '../filter/AudioVolumeFilter.ts';
import { LoudnormFilter } from '../filter/LoudnormFilter.ts';
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

  test('add loudnorm filter when loudnormConfig is set', () => {
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
        loudnormConfig: { i: -24, lra: 7, tp: -2 },
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

    const loudnormFilter = result.inputs.audioInput?.filterSteps.find(
      (step) => step instanceof LoudnormFilter,
    );

    expect(loudnormFilter).toBeDefined();
    expect(loudnormFilter?.filter).toEqual(
      'loudnorm=I=-24:LRA=7:TP=-2,aresample=48000',
    );
  });

  test('add loudnorm filter with custom offset gain', () => {
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
        loudnormConfig: { i: -16, lra: 11, tp: -1, offsetGain: 3 },
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

    const loudnormFilter = result.inputs.audioInput?.filterSteps.find(
      (step) => step instanceof LoudnormFilter,
    );

    expect(loudnormFilter).toBeDefined();
    expect(loudnormFilter?.filter).toEqual(
      'loudnorm=I=-16:LRA=11:TP=-1:offset=3,aresample=48000',
    );
  });

  test('use custom sample rate in loudnorm filter when audioSampleRate is set', () => {
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
        audioSampleRate: 44100,
        loudnormConfig: { i: -24, lra: 7, tp: -2 },
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

    const loudnormFilter = result.inputs.audioInput?.filterSteps.find(
      (step) => step instanceof LoudnormFilter,
    );

    expect(loudnormFilter).toBeDefined();
    expect(loudnormFilter?.filter).toEqual(
      'loudnorm=I=-24:LRA=7:TP=-2,aresample=44100',
    );
  });

  test('do not add loudnorm filter when audio encoder is copy', () => {
    const audio = AudioInputSource.withStream(
      new FileStreamSource('/path/to/song.flac'),
      AudioStream.create({
        channels: 2,
        codec: 'flac',
        index: 0,
      }),
      AudioState.create({
        audioEncoder: 'copy',
        loudnormConfig: { i: -24, lra: 7, tp: -2 },
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

    const loudnormFilter = result.inputs.audioInput?.filterSteps.find(
      (step) => step instanceof LoudnormFilter,
    );

    expect(loudnormFilter).toBeUndefined();
  });

  test.each([
    { desc: 'i too low', config: { i: -70.1, lra: 7, tp: -2 } },
    { desc: 'i too high', config: { i: -4.9, lra: 7, tp: -2 } },
    { desc: 'lra too low', config: { i: -24, lra: 0.9, tp: -2 } },
    { desc: 'lra too high', config: { i: -24, lra: 50.1, tp: -2 } },
    { desc: 'tp too low', config: { i: -24, lra: 7, tp: -9.1 } },
    { desc: 'tp too high', config: { i: -24, lra: 7, tp: 0.1 } },
  ])(
    'do not add loudnorm filter when $desc',
    ({ config }) => {
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
          loudnormConfig: config,
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

      const loudnormFilter = result.inputs.audioInput?.filterSteps.find(
        (step) => step instanceof LoudnormFilter,
      );

      expect(loudnormFilter).toBeUndefined();
    },
  );

  test.each([
    { desc: 'i at lower bound', config: { i: -70, lra: 7, tp: -2 } },
    { desc: 'i at upper bound', config: { i: -5, lra: 7, tp: -2 } },
    { desc: 'lra at lower bound', config: { i: -24, lra: 1, tp: -2 } },
    { desc: 'lra at upper bound', config: { i: -24, lra: 50, tp: -2 } },
    { desc: 'tp at lower bound', config: { i: -24, lra: 7, tp: -9 } },
    { desc: 'tp at upper bound', config: { i: -24, lra: 7, tp: 0 } },
  ])(
    'add loudnorm filter when $desc',
    ({ config }) => {
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
          loudnormConfig: config,
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

      const loudnormFilter = result.inputs.audioInput?.filterSteps.find(
        (step) => step instanceof LoudnormFilter,
      );

      expect(loudnormFilter).toBeDefined();
    },
  );

  test('do not add loudnorm filter when loudnormConfig is not set', () => {
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

    const loudnormFilter = result.inputs.audioInput?.filterSteps.find(
      (step) => step instanceof LoudnormFilter,
    );

    expect(loudnormFilter).toBeUndefined();
  });
});
