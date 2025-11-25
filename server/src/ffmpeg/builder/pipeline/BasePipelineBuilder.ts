import { HardwareAccelerationMode } from '@/db/schema/TranscodeConfig.js';
import {
  SubtitleMethods,
  type AudioStream,
  type SubtitleStream,
  type VideoStream,
} from '@/ffmpeg/builder/MediaStream.js';
import type { FfmpegCapabilities } from '@/ffmpeg/builder/capabilities/FfmpegCapabilities.js';
import { Av1Decoder } from '@/ffmpeg/builder/decoder/Av1Decoder.js';
import type { Decoder } from '@/ffmpeg/builder/decoder/Decoder.js';
import { H264Decoder } from '@/ffmpeg/builder/decoder/H264Decoder.js';
import { HevcDecoder } from '@/ffmpeg/builder/decoder/HevcDecoder.js';
import { ImplicitDecoder } from '@/ffmpeg/builder/decoder/ImplicitDecoder.js';
import { Mpeg2Decoder } from '@/ffmpeg/builder/decoder/Mpeg2Decoder.js';
import { Mpeg4Decoder } from '@/ffmpeg/builder/decoder/Mpeg4Decoder.js';
import { RawVideoDecoder } from '@/ffmpeg/builder/decoder/RawVideoDecoder.js';
import { Vc1Decoder } from '@/ffmpeg/builder/decoder/Vc1Decoder.js';
import type { VideoEncoder } from '@/ffmpeg/builder/encoder/BaseEncoder.js';
import { AudioEncoder } from '@/ffmpeg/builder/encoder/BaseEncoder.js';
import { Encoder } from '@/ffmpeg/builder/encoder/Encoder.js';
import { AudioPadFilter } from '@/ffmpeg/builder/filter/AudioPadFilter.js';
import { AudioResampleFilter } from '@/ffmpeg/builder/filter/AudioResampleFilter.js';
import { ComplexFilter } from '@/ffmpeg/builder/filter/ComplexFilter.js';
import { FilterChain } from '@/ffmpeg/builder/filter/FilterChain.js';
import { LoopFilter } from '@/ffmpeg/builder/filter/LoopFilter.js';
import { RealtimeFilter } from '@/ffmpeg/builder/filter/RealtimeFilter.js';
import type { AudioInputSource } from '@/ffmpeg/builder/input/AudioInputSource.js';
import type { ConcatInputSource } from '@/ffmpeg/builder/input/ConcatInputSource.js';
import type { VideoInputSource } from '@/ffmpeg/builder/input/VideoInputSource.js';
import type { WatermarkInputSource } from '@/ffmpeg/builder/input/WatermarkInputSource.js';
import { HlsConcatOutputFormat } from '@/ffmpeg/builder/options/HlsConcatOutputFormat.js';
import { HlsOutputFormat } from '@/ffmpeg/builder/options/HlsOutputFormat.js';
import { LogLevelOption } from '@/ffmpeg/builder/options/LogLevelOption.js';
import { NoStatsOption } from '@/ffmpeg/builder/options/NoStatsOption.js';
import { ConcatHttpReconnectOptions } from '@/ffmpeg/builder/options/input/ConcatHttpReconnectOptions.js';
import { ConcatInputFormatOption } from '@/ffmpeg/builder/options/input/ConcatInputFormatOption.js';
import { HttpReconnectOptions } from '@/ffmpeg/builder/options/input/HttpReconnectOptions.js';
import { InfiniteLoopInputOption } from '@/ffmpeg/builder/options/input/InfiniteLoopInputOption.js';
import { ReadrateInputOption } from '@/ffmpeg/builder/options/input/ReadrateInputOption.js';
import { StreamSeekInputOption } from '@/ffmpeg/builder/options/input/StreamSeekInputOption.js';
import { UserAgentInputOption } from '@/ffmpeg/builder/options/input/UserAgentInputOption.js';
import type { AudioState } from '@/ffmpeg/builder/state/AudioState.js';
import type {
  FfmpegState,
  PipelineOptions,
} from '@/ffmpeg/builder/state/FfmpegState.js';
import type { FrameState } from '@/ffmpeg/builder/state/FrameState.js';
import type { DataProps } from '@/ffmpeg/builder/types.js';
import { FrameDataLocation } from '@/ffmpeg/builder/types.js';
import type {
  IPipelineStep,
  PipelineStep,
} from '@/ffmpeg/builder/types/PipelineStep.js';
import type { Nilable, Nullable } from '@/types/util.js';
import { ifDefined, isNonEmptyString } from '@/util/index.js';
import type { Logger } from '@/util/logging/LoggerFactory.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import { getTunarrVersion } from '@/util/version.js';
import { filter, first, isNil, isNull, isUndefined, merge } from 'lodash-es';
import type { DeepReadonly, MarkRequired } from 'ts-essentials';
import { P, match } from 'ts-pattern';
import {
  OutputFormatTypes,
  OutputLocation,
  VideoFormats,
} from '../constants.ts';
import {
  CopyAllEncoder,
  CopyAudioEncoder,
  CopyVideoEncoder,
} from '../encoder/CopyEncoders.ts';
import { ImplicitVideoEncoder } from '../encoder/ImplicitVideoEncoder.ts';
import { LibKvazaarEncoder } from '../encoder/LibKvazaarEncoder.ts';
import { LibOpenH264Encoder } from '../encoder/LibOpenH264Encoder.ts';
import { Libx264Encoder } from '../encoder/Libx264Encoder.ts';
import { Libx265Encoder } from '../encoder/Libx265Encoder.ts';
import { Mpeg2VideoEncoder } from '../encoder/Mpeg2VideoEncoder.ts';
import { RawVideoEncoder } from '../encoder/RawVideoEncoder.ts';
import type { FilterOption } from '../filter/FilterOption.ts';
import { StreamSeekFilter } from '../filter/StreamSeekFilter.ts';
import type { SubtitlesInputSource } from '../input/SubtitlesInputSource.ts';
import {
  AudioBitrateOutputOption,
  AudioBufferSizeOutputOption,
  AudioChannelsOutputOption,
  AudioSampleRateOutputOption,
} from '../options/AudioOutputOptions.ts';
import {
  HideBannerOption,
  NoStdInOption,
  StandardFormatFlags,
  ThreadCountOption,
} from '../options/GlobalOption.ts';
import {
  ClosedGopOutputOption,
  DoNotMapMetadataOutputOption,
  FastStartOutputOption,
  MapAllStreamsOutputOption,
  MatroskaOutputFormatOption,
  MetadataServiceNameOutputOption,
  MetadataServiceProviderOutputOption,
  Mp4OutputFormatOption,
  Mp4OutputOptions,
  MpegTsOutputFormatOption,
  NoAutoScaleOutputOption,
  NoDemuxDecodeDelayOutputOption,
  NoSceneDetectOutputOption,
  NutOutputFormatOption,
  OutputTsOffsetOption,
  PipeProtocolOutputOption,
  TimeLimitOutputOption,
  VideoBitrateOutputOption,
  VideoBufferSizeOutputOption,
  VideoTrackTimescaleOutputOption,
} from '../options/OutputOption.ts';
import { FrameRateOutputOption } from '../options/output/FrameRateOutputOption.ts';
import { Pipeline } from './Pipeline.ts';
import type { PipelineBuilder } from './PipelineBuilder.ts';

// Args passed to each setter -- we use an object here so we
// 1. can deconstruct args in each implementor to use only what we need
// 2. easily add more (does not affect argument list)
export type PipelineVideoFunctionArgs = {
  videoStream: VideoStream;
  ffmpegState: FfmpegState;
  desiredState: FrameState;
  pipelineSteps: IPipelineStep[];
  filterChain: FilterChain;
  decoder: Nullable<Decoder>;
};

export type PipelineAudioFunctionArgs = {
  audioStream: AudioStream;
  ffmpegState: FfmpegState;
  desiredState: AudioState;
  pipelineSteps: IPipelineStep[];
};

type PipelineBuilderContextProps = DataProps<PipelineBuilderContext>;

export class PipelineBuilderContext {
  videoStream?: VideoStream;
  audioStream?: AudioStream;
  subtitleStream?: SubtitleStream;
  ffmpegState: FfmpegState;
  desiredState: FrameState;
  desiredAudioState?: AudioState;
  pipelineOptions: DeepReadonly<PipelineOptions>;

  pipelineSteps: PipelineStep[];
  filterChain: FilterChain;
  hasWatermark: boolean;
  shouldDeinterlace: boolean;
  is10BitOutput: boolean;
  isIntelVaapiOrQsv: boolean;

  constructor(props: PipelineBuilderContextProps) {
    merge(this, props);
  }

  hasSubtitleOverlay() {
    return (
      (this.subtitleStream?.isImageBased &&
        this.subtitleStream?.method === SubtitleMethods.Burn) ??
      false
    );
  }

  hasSubtitleTextContext() {
    return (
      (this.subtitleStream &&
        !this.subtitleStream.isImageBased &&
        this.subtitleStream.method === SubtitleMethods.Burn) ??
      false
    );
  }
}

export type PipelineBuilderContextWithVideo = MarkRequired<
  PipelineBuilderContext,
  'videoStream'
>;
export type PipelineBuilderContextWithAudio = MarkRequired<
  PipelineBuilderContext,
  'audioStream' | 'desiredAudioState'
>;

export function isVideoPipelineContext(
  context: PipelineBuilderContext,
): context is PipelineBuilderContextWithVideo {
  return !isUndefined(context.videoStream);
}

export function isAudioPipelineContext(
  context: PipelineBuilderContext,
): context is PipelineBuilderContextWithAudio {
  return (
    !isUndefined(context.audioStream) && !isUndefined(context.desiredAudioState)
  );
}

export abstract class BasePipelineBuilder implements PipelineBuilder {
  protected logger: Logger = LoggerFactory.child({
    caller: import.meta,
    className: this.constructor.name,
  });
  protected decoder: Nullable<Decoder> = null;
  protected context: PipelineBuilderContext;

  constructor(
    protected nullableVideoInputSource: Nullable<VideoInputSource>,
    private audioInputSource: Nullable<AudioInputSource>,
    protected watermarkInputSource: Nullable<WatermarkInputSource>,
    protected subtitleInputSource: Nullable<SubtitlesInputSource>,
    protected concatInputSource: Nullable<ConcatInputSource>,
    protected ffmpegCapabilities: FfmpegCapabilities,
  ) {}

  get videoInputSource(): VideoInputSource {
    // Only use this on video pipelines!!!
    return this.nullableVideoInputSource!;
  }

  validate(): Nullable<Error> {
    return null;
  }

  concat(input: ConcatInputSource, state: FfmpegState) {
    const pipelineSteps: PipelineStep[] = [
      new NoStdInOption(),
      new HideBannerOption(),
      new NoStatsOption(),
      new LogLevelOption(state.logLevel),
      new StandardFormatFlags(),
      NoDemuxDecodeDelayOutputOption(),
      FastStartOutputOption(),
      ClosedGopOutputOption(),
    ];

    input.addOptions(
      new ConcatInputFormatOption(),
      new ReadrateInputOption(this.ffmpegCapabilities, 0),
      new InfiniteLoopInputOption(),
      new UserAgentInputOption(`Ffmpeg Tunarr/${getTunarrVersion()}`),
    );

    if (input.protocol === 'http') {
      input.addOption(new ConcatHttpReconnectOptions());
    }

    if (state.threadCount) {
      pipelineSteps.unshift(new ThreadCountOption(state.threadCount));
    }

    pipelineSteps.push(NoSceneDetectOutputOption(0), new CopyAllEncoder());
    if (state.metadataServiceName) {
      pipelineSteps.push(
        MetadataServiceNameOutputOption(state.metadataServiceName),
      );
    }
    if (state.metadataServiceProvider) {
      pipelineSteps.push(
        MetadataServiceProviderOutputOption(state.metadataServiceProvider),
      );
    }
    pipelineSteps.push(MpegTsOutputFormatOption(), PipeProtocolOutputOption());

    return new Pipeline(pipelineSteps, {
      videoInput: null,
      audioInput: null,
      concatInput: input,
      watermarkInput: null,
    });
  }

  hlsWrap(input: ConcatInputSource, state: FfmpegState) {
    const pipelineSteps: PipelineStep[] = [
      new NoStdInOption(),
      new HideBannerOption(),
      new ThreadCountOption(1),
      new LogLevelOption(state.logLevel),
      new NoStatsOption(),
      new StandardFormatFlags(),
      MapAllStreamsOutputOption(),
      new CopyAllEncoder(),
    ];

    if (input.protocol === 'http') {
      input.addOption(new ConcatHttpReconnectOptions());
    }

    input.addOption(new ReadrateInputOption(this.ffmpegCapabilities, 0));
    if (state.metadataServiceName) {
      pipelineSteps.push(
        MetadataServiceNameOutputOption(state.metadataServiceName),
      );
    }
    if (state.metadataServiceProvider) {
      pipelineSteps.push(
        MetadataServiceProviderOutputOption(state.metadataServiceProvider),
      );
    }
    pipelineSteps.push(
      MpegTsOutputFormatOption(false),
      PipeProtocolOutputOption(),
    );

    return new Pipeline(pipelineSteps, {
      videoInput: null,
      audioInput: null,
      concatInput: input,
      watermarkInput: null,
    });
  }

  build(
    ffmpegState: FfmpegState,
    desiredState: FrameState,
    pipelineOptions: PipelineOptions,
  ): Pipeline {
    this.context = new PipelineBuilderContext({
      videoStream: first(this.videoInputSource.streams),
      audioStream: first(this.audioInputSource?.streams),
      subtitleStream: first(this.subtitleInputSource?.streams),
      ffmpegState,
      desiredState,
      desiredAudioState: this.audioInputSource?.desiredState,
      pipelineSteps: [],
      filterChain: new FilterChain(),
      hasWatermark: !!this.watermarkInputSource,
      is10BitOutput: (desiredState.pixelFormat?.bitDepth ?? 8) === 10,
      shouldDeinterlace: desiredState.deinterlace,
      isIntelVaapiOrQsv: false,
      pipelineOptions,
    });

    this.logger.debug(
      'Creating ffmpeg transcode pipeline with context: %O',
      this.context,
    );

    this.context.pipelineSteps = [
      new NoStdInOption(),
      new HideBannerOption(),
      new NoStatsOption(),
      new LogLevelOption(ffmpegState.logLevel),
      new StandardFormatFlags(),
      NoDemuxDecodeDelayOutputOption(),
      ClosedGopOutputOption(),
    ];

    const movFlags =
      this.ffmpegState.outputFormat.type === OutputFormatTypes.Mp4 ||
      (this.ffmpegState.outputFormat.type === OutputFormatTypes.Hls &&
        this.ffmpegState.hlsSegmentTemplate?.includes('m4s'))
        ? Mp4OutputOptions()
        : FastStartOutputOption();
    this.pipelineSteps.push(movFlags);

    // TODO BFrames
    if (isNull(this.nullableVideoInputSource)) {
      throw new Error('FFmpeg pipeline currently requires a video input');
    }

    if (this.concatInputSource) {
      this.concatInputSource.addOptions(
        new ConcatInputFormatOption(),
        new InfiniteLoopInputOption(),
      );
      this.pipelineSteps.push(NoAutoScaleOutputOption());
    }

    this.setStreamSeek();

    if (this.ffmpegState.duration && +this.ffmpegState.duration > 0) {
      this.pipelineSteps.push(TimeLimitOutputOption(this.ffmpegState.duration));
    }

    if (
      this.videoInputSource.protocol === 'http' &&
      this.videoInputSource.continuity === 'discrete'
    ) {
      this.videoInputSource.addOption(new HttpReconnectOptions());
    }

    if (
      this.audioInputSource?.path &&
      this.audioInputSource.protocol === 'http' &&
      this.audioInputSource.continuity === 'discrete' &&
      this.videoInputSource.path !== this.audioInputSource.path
    ) {
      this.audioInputSource.addOption(new HttpReconnectOptions());
    }

    if (
      this.desiredState.videoFormat !== 'copy' &&
      (this.ffmpegState.ptsOffset ?? 0) > 0 &&
      !isNull(this.desiredState.videoTrackTimescale)
    ) {
      this.pipelineSteps.push(
        OutputTsOffsetOption(
          this.ffmpegState.ptsOffset ?? 0,
          this.desiredState.videoTrackTimescale,
        ),
      );
    }

    if (isVideoPipelineContext(this.context)) {
      this.buildVideoPipeline();
    }

    this.context.pipelineSteps.unshift(
      ...this.getThreadCountOption(ffmpegState),
    );

    this.setSceneDetect();

    if (isNull(this.audioInputSource)) {
      this.context.pipelineSteps.push(new CopyAudioEncoder());
    } else if (this.audioInputSource.streams.length > 0) {
      this.buildAudioPipeline();
    }

    // metadata
    if (this.ffmpegState.doNotMapMetadata) {
      this.pipelineSteps.push(DoNotMapMetadataOutputOption());
    }

    if (isNonEmptyString(this.ffmpegState.metadataServiceProvider)) {
      this.pipelineSteps.push(
        MetadataServiceProviderOutputOption(
          this.ffmpegState.metadataServiceProvider,
        ),
      );
    }

    if (isNonEmptyString(this.ffmpegState.metadataServiceName)) {
      this.pipelineSteps.push(
        MetadataServiceNameOutputOption(this.ffmpegState.metadataServiceName),
      );
    }

    if (
      !isNull(this.concatInputSource) &&
      isNonEmptyString(this.ffmpegState.hlsSegmentTemplate) &&
      isNonEmptyString(this.ffmpegState.hlsPlaylistPath) &&
      isNonEmptyString(this.ffmpegState.hlsBaseStreamUrl)
    ) {
      this.pipelineSteps.push(
        new HlsConcatOutputFormat(
          this.ffmpegState.hlsSegmentTemplate,
          this.ffmpegState.hlsPlaylistPath,
          this.ffmpegState.hlsBaseStreamUrl,
        ),
      );
    } else {
      this.setOutputFormat();
    }

    this.pipelineSteps.push(
      new ComplexFilter(
        this.videoInputSource,
        this.audioInputSource,
        this.subtitleInputSource,
        this.watermarkInputSource,
        this.context.filterChain,
      ),
    );

    return new Pipeline(this.pipelineSteps, {
      videoInput: this.videoInputSource,
      audioInput: this.audioInputSource,
      watermarkInput: this.watermarkInputSource,
      concatInput: this.concatInputSource,
    });
  }

  protected get ffmpegState() {
    return this.context.ffmpegState;
  }

  protected get desiredState() {
    return this.context.desiredState;
  }

  protected get desiredAudioState() {
    return this.context.desiredAudioState;
  }

  protected get pipelineSteps() {
    return this.context.pipelineSteps;
  }

  protected get filterChain() {
    return this.context.filterChain;
  }

  protected get subtitleOverlayFilterChain() {
    return this.filterChain.subtitleOverlayFilterSteps;
  }

  protected buildVideoPipeline() {
    this.setHardwareAccelState();

    this.logger.debug(
      'Input = %O, Output = %O. Using decode mode = %s and encode mode = %s',
      {
        codec: this.context.videoStream?.codec,
        bitDepth: this.context.videoStream?.bitDepth(),
      },
      {
        codec: this.desiredState.videoFormat,
        bitDepth: this.desiredState.bitDepth,
      },
      this.ffmpegState.decoderHwAccelMode,
      this.ffmpegState.encoderHwAccelMode,
    );

    if (
      isVideoPipelineContext(this.context) &&
      this.desiredState.videoFormat !== VideoFormats.Copy
    ) {
      this.decoder = this.setupDecoder();
      if (this.decoder) {
        this.logger.debug('Setup decoder: %O', this.decoder);
      }
    }

    this.setRealtime();

    if (this.desiredState.infiniteLoop) {
      this.videoInputSource?.addOption(new InfiniteLoopInputOption());
      this.audioInputSource?.addOption(new InfiniteLoopInputOption());
    }

    if (
      this.desiredState.videoFormat !== VideoFormats.Copy &&
      this.desiredState.frameRate
    ) {
      this.pipelineSteps.push(
        new FrameRateOutputOption(this.desiredState.frameRate),
      );
    }

    ifDefined(this.desiredState.videoTrackTimescale, (ts) =>
      this.pipelineSteps.push(VideoTrackTimescaleOutputOption(ts)),
    );

    if (this.ffmpegState.outputFormat.type !== OutputFormatTypes.Nut) {
      ifDefined(this.desiredState.videoBitrate, (br) =>
        this.pipelineSteps.push(VideoBitrateOutputOption(br)),
      );

      ifDefined(this.desiredState.videoBufferSize, (bs) =>
        this.pipelineSteps.push(VideoBufferSizeOutputOption(bs)),
      );
    }

    this.setupVideoFilters();
  }

  protected buildAudioPipeline() {
    if (!isAudioPipelineContext(this.context)) {
      return;
    }

    const encoder = new AudioEncoder(
      this.context.desiredAudioState.audioEncoder,
    );
    this.pipelineSteps.push(encoder);

    if (!isNull(this.context.desiredAudioState.audioChannels)) {
      this.pipelineSteps.push(
        AudioChannelsOutputOption(
          this.context.audioStream.codec,
          this.context.audioStream.channels,
          this.context.desiredAudioState.audioChannels,
        ),
      );
    }

    if (this.ffmpegState.outputFormat.type !== OutputFormatTypes.Nut) {
      this.pushSettingIfDefined(
        this.context.desiredAudioState.audioBitrate,
        AudioBitrateOutputOption,
      );

      this.pushSettingIfDefined(
        this.context.desiredAudioState.audioBufferSize,
        AudioBufferSizeOutputOption,
      );

      this.pushSettingIfDefined(
        this.context.desiredAudioState.audioSampleRate,
        AudioSampleRateOutputOption,
      );
    }

    // TODO Audio volumne
    if (encoder.name !== 'copy') {
      // This seems to help with audio sync issues in QSV
      const asyncSamples =
        this.ffmpegState.decoderHwAccelMode === HardwareAccelerationMode.Qsv
          ? 1000
          : 1;
      this.audioInputSource?.filterSteps.push(
        new AudioResampleFilter(asyncSamples),
      );

      if (!isNull(this.context.desiredAudioState.audioDuration)) {
        this.audioInputSource?.filterSteps.push(new AudioPadFilter());
      }
    }
  }

  protected abstract setupVideoFilters(): void;

  protected setupEncoder(currentState: FrameState): Nullable<VideoEncoder> {
    if (!isVideoPipelineContext(this.context)) {
      return null;
    }

    if (this.ffmpegState.outputFormat.type === OutputFormatTypes.Nut) {
      return new RawVideoEncoder();
    }

    return match(this.desiredState.videoFormat)
      .with(
        VideoFormats.Hevc,
        () => this.ffmpegCapabilities.hasVideoEncoder('libx265'),
        () =>
          new Libx265Encoder(
            currentState.updateFrameLocation(FrameDataLocation.Software),
            this.desiredState.videoPreset,
          ),
      )
      .with(
        VideoFormats.Hevc,
        () => this.ffmpegCapabilities.hasVideoEncoder('libkvazaar'),
        () =>
          new LibKvazaarEncoder(
            currentState.updateFrameLocation(FrameDataLocation.Software),
            this.desiredState.videoPreset,
          ),
      )
      .with(
        VideoFormats.H264,
        () => this.ffmpegCapabilities.hasVideoEncoder('libx264'),
        () =>
          new Libx264Encoder(
            this.desiredState.videoProfile,
            this.desiredState.videoPreset,
          ),
      )
      .with(
        VideoFormats.H264,
        () => this.ffmpegCapabilities.hasVideoEncoder('libopenh264'),
        () => new LibOpenH264Encoder(this.desiredState.videoProfile),
      )
      .with(VideoFormats.Mpeg2Video, () => new Mpeg2VideoEncoder())
      .with(VideoFormats.Copy, () => new CopyVideoEncoder())
      .with(P._, () => new ImplicitVideoEncoder())
      .exhaustive();
  }

  protected setupDecoder(): Nullable<Decoder> {
    let decoder: Nullable<Decoder> = null;
    if (isVideoPipelineContext(this.context)) {
      decoder = match(this.context.videoStream.codec)
        .with(VideoFormats.H264, () => new H264Decoder())
        .with(VideoFormats.Hevc, () => new HevcDecoder())
        .with(VideoFormats.Vc1, () => new Vc1Decoder())
        .with(VideoFormats.Mpeg2Video, () => new Mpeg2Decoder())
        .with(VideoFormats.Mpeg4, () => new Mpeg4Decoder())
        .with(VideoFormats.Raw, () => new RawVideoDecoder())
        .with(
          VideoFormats.Av1,
          () => this.ffmpegCapabilities.hasVideoEncoder('libdav1d'),
          () => new Av1Decoder('libdav1d'),
        )
        .with(
          VideoFormats.Av1,
          () => this.ffmpegCapabilities.hasVideoEncoder('libaom-av1'),
          () => new Av1Decoder('libaom-av1'),
        )
        .with(VideoFormats.Av1, () => new Av1Decoder('av1'))
        .otherwise(() => new ImplicitDecoder());
      this.videoInputSource.addOption(decoder);
    }
    this.decoder = decoder;
    return decoder;
  }

  protected setHardwareAccelState() {
    this.context.ffmpegState.decoderHwAccelMode = 'none';
    this.context.ffmpegState.encoderHwAccelMode = 'none';
  }

  protected setSceneDetect() {
    if (!isVideoPipelineContext(this.context)) {
      return;
    }

    // Explicitly set -sc_threshold to a crazy amount for mpeg2 or when decoding with videotoolbox (mpeg2 doesn't support)
    if (
      this.context.videoStream.codec === VideoFormats.Mpeg2Video ||
      this.desiredState.videoFormat === VideoFormats.Mpeg2Video ||
      this.ffmpegState.decoderHwAccelMode ===
        HardwareAccelerationMode.Videotoolbox
    ) {
      this.pipelineSteps.push(NoSceneDetectOutputOption(1_000_000_000));
    } else if (
      this.ffmpegState.encoderHwAccelMode === HardwareAccelerationMode.None
    ) {
      this.pipelineSteps.push(NoSceneDetectOutputOption(0));
    }
  }

  protected setStreamSeek() {
    if (this.ffmpegState.start && +this.ffmpegState.start > 0) {
      const option = new StreamSeekInputOption(this.ffmpegState.start);
      this.audioInputSource?.addOption(option);
      this.videoInputSource.addOption(option);

      if (this.context.hasSubtitleTextContext()) {
        this.pipelineSteps.push(new StreamSeekFilter(this.ffmpegState.start));
      }
    }
  }

  protected setRealtime() {
    const initialBurst = this.desiredState.realtime ? 0 : 60;
    const option = new ReadrateInputOption(
      this.ffmpegCapabilities,
      initialBurst,
    );
    this.audioInputSource?.addOption(option);
    this.videoInputSource.addOption(option);
  }

  protected setOutputFormat() {
    // this.context.pipelineSteps.push(
    //   this.context.ffmpegState.outputFormat === OutputFormats.Mkv
    //     ? MatroskaOutputFormatOption()
    //     : MpegTsOutputFormatOption(),
    //   PipeProtocolOutputOption(),
    // );
    switch (this.ffmpegState.outputFormat.type) {
      case OutputFormatTypes.Mkv:
        this.pipelineSteps.push(MatroskaOutputFormatOption());
        break;
      case OutputFormatTypes.MpegTs:
        this.pipelineSteps.push(MpegTsOutputFormatOption());
        break;
      case OutputFormatTypes.Mp4:
        this.pipelineSteps.push(Mp4OutputFormatOption());
        break;
      case OutputFormatTypes.Nut: {
        if (this.desiredState.bitDepth > 8) {
          this.pipelineSteps.push(NutOutputFormatOption());
        } else {
          this.pipelineSteps.push(MatroskaOutputFormatOption());
        }
        break;
      }
      case OutputFormatTypes.Hls: {
        if (
          isNonEmptyString(this.ffmpegState.hlsPlaylistPath) &&
          isNonEmptyString(this.ffmpegState.hlsSegmentTemplate) &&
          isNonEmptyString(this.ffmpegState.hlsBaseStreamUrl)
        ) {
          this.pipelineSteps.push(
            new HlsOutputFormat(
              this.desiredState,
              this.context.videoStream?.getNumericFrameRateOrDefault() ?? 24,
              this.ffmpegState.hlsPlaylistPath,
              this.ffmpegState.hlsSegmentTemplate,
              this.ffmpegState.hlsBaseStreamUrl,
              isNil(this.ffmpegState.ptsOffset) ||
                this.ffmpegState.ptsOffset === 0,
              this.ffmpegState.encoderHwAccelMode ===
                HardwareAccelerationMode.Qsv,
            ),
          );
        }
        break;
      }
      case OutputFormatTypes.Dash:
        throw new Error('MPEG-DASH streaming is not yet implemented');
    }

    if (this.ffmpegState.outputFormat.type !== OutputFormatTypes.Hls) {
      switch (this.ffmpegState.outputLocation) {
        case OutputLocation.Stdout:
          this.pipelineSteps.push(PipeProtocolOutputOption());
          break;
      }
    }
  }

  protected getThreadCountOption(ffmpegState: FfmpegState) {
    let threadCount: Nullable<number> = null;
    if (ffmpegState.decoderHwAccelMode !== HardwareAccelerationMode.None) {
      this.logger.debug(
        `Forcing 1 ffmpeg decoding thread due to use of hardware accelerated decoding.`,
      );
      threadCount = 1;
    } else if (
      !isNull(ffmpegState.threadCount) &&
      ffmpegState.threadCount > 0
    ) {
      threadCount = ffmpegState.threadCount;
    }

    if (!isNull(threadCount)) {
      return [new ThreadCountOption(threadCount)];
    }

    return [];
  }

  protected setStillImageLoop() {
    if (!isVideoPipelineContext(this.context)) {
      return;
    }

    if (this.context.videoStream.inputKind === 'stillimage') {
      this.videoInputSource.filterSteps.push(new LoopFilter());
      if (this.desiredState.realtime) {
        this.videoInputSource.filterSteps.push(new RealtimeFilter());
      }
    }
  }

  protected pushSettingIfDefined<T>(
    setting: Nilable<T>,
    factory: (value: T) => PipelineStep,
  ) {
    ifDefined(setting, (v) => this.pipelineSteps.push(factory(v)));
  }

  protected getEncoderSteps() {
    return filter(
      this.pipelineSteps,
      (step): step is Encoder => step instanceof Encoder,
    );
  }

  protected getIsIntelQsvOrVaapi() {
    return false;
  }

  protected addFilterToVideoChain(
    currentState: FrameState,
    filter: FilterOption,
  ): FrameState {
    this.videoInputSource.filterSteps.push(filter);
    const nextState = filter.nextState(currentState);
    this.videoInputSource.frameDataLocation = nextState.frameDataLocation;
    return nextState;
  }
}
