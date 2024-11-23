import { AudioStream, VideoStream } from '@/ffmpeg/builder/MediaStream.ts';
import { FfmpegCapabilities } from '@/ffmpeg/builder/capabilities/FfmpegCapabilities.ts';
import { Decoder } from '@/ffmpeg/builder/decoder/Decoder.ts';
import { DecoderFactory } from '@/ffmpeg/builder/decoder/DecoderFactory.ts';
import {
  AudioEncoder,
  VideoEncoder,
} from '@/ffmpeg/builder/encoder/BaseEncoder.ts';
import { Encoder } from '@/ffmpeg/builder/encoder/Encoder.ts';
import { AudioPadFilter } from '@/ffmpeg/builder/filter/AudioPadFilter.ts';
import { AudioFirstPtsFilter } from '@/ffmpeg/builder/filter/AudioResampleFilter.ts';
import { ComplexFilter } from '@/ffmpeg/builder/filter/ComplexFilter.ts';
import { FilterChain } from '@/ffmpeg/builder/filter/FilterChain.ts';
import { LoopFilter } from '@/ffmpeg/builder/filter/LoopFilter.ts';
import { RealtimeFilter } from '@/ffmpeg/builder/filter/RealtimeFilter.ts';
import { AudioInputSource } from '@/ffmpeg/builder/input/AudioInputSource.ts';
import { ConcatInputSource } from '@/ffmpeg/builder/input/ConcatInputSource.ts';
import { VideoInputSource } from '@/ffmpeg/builder/input/VideoInputSource.ts';
import { WatermarkInputSource } from '@/ffmpeg/builder/input/WatermarkInputSource.ts';
import { HlsConcatOutputFormat } from '@/ffmpeg/builder/options/HlsConcatOutputFormat.ts';
import { HlsOutputFormat } from '@/ffmpeg/builder/options/HlsOutputFormat.ts';
import { LogLevelOption } from '@/ffmpeg/builder/options/LogLevelOption.ts';
import { NoStatsOption } from '@/ffmpeg/builder/options/NoStatsOption.ts';
import { ConcatHttpReconnectOptions } from '@/ffmpeg/builder/options/input/ConcatHttpReconnectOptions.ts';
import { ConcatInputFormatOption } from '@/ffmpeg/builder/options/input/ConcatInputFormatOption.ts';
import { HttpReconnectOptions } from '@/ffmpeg/builder/options/input/HttpReconnectOptions.ts';
import { InfiniteLoopInputOption } from '@/ffmpeg/builder/options/input/InfiniteLoopInputOption.ts';
import { ReadrateInputOption } from '@/ffmpeg/builder/options/input/ReadrateInputOption.ts';
import { StreamSeekInputOption } from '@/ffmpeg/builder/options/input/StreamSeekInputOption.ts';
import { UserAgentInputOption } from '@/ffmpeg/builder/options/input/UserAgentInputOption.ts';
import { AudioState } from '@/ffmpeg/builder/state/AudioState.ts';
import { FfmpegState } from '@/ffmpeg/builder/state/FfmpegState.ts';
import { FrameState } from '@/ffmpeg/builder/state/FrameState.ts';
import {
  FrameDataLocation,
  HardwareAccelerationMode,
} from '@/ffmpeg/builder/types.ts';
import {
  IPipelineStep,
  PipelineStep,
} from '@/ffmpeg/builder/types/PipelineStep.ts';
import { Nilable, Nullable } from '@/types/util.ts';
import { ifDefined, isNonEmptyString } from '@/util/index.ts';
import { Logger, LoggerFactory } from '@/util/logging/LoggerFactory.ts';
import { getTunarrVersion } from '@/util/version.ts';
import { find, first, isNil, isNull, isUndefined } from 'lodash-es';
import { MarkRequired } from 'ts-essentials';
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
import {
  ImplicitVideoEncoder,
  LibKvazaarEncoder,
  LibOpenH264Encoder,
  Libx264Encoder,
  Libx265Encoder,
  RawVideoEncoder,
} from '../encoder/SoftwareVideoEncoders.ts';
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
  FrameRateOutputOption,
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
import { Pipeline } from './Pipeline.ts';
import { PipelineBuilder } from './PipelineBuilder.ts';

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

export type PipelineBuilderContext = {
  videoStream?: VideoStream;
  audioStream?: AudioStream;
  ffmpegState: FfmpegState;
  desiredState: FrameState;
  desiredAudioState?: AudioState;
  pipelineSteps: PipelineStep[];
  filterChain: FilterChain;
  decoder: Nullable<Decoder>;

  hasWatermark: boolean;
  hasSubtitleOverlay: boolean;
  shouldDeinterlace: boolean;
  is10BitOutput: boolean;
  isIntelVaapiOrQsv: boolean;
};

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
    // TODO: save report

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

  build(ffmpegState: FfmpegState, desiredState: FrameState): Pipeline {
    this.context = {
      videoStream: first(this.videoInputSource.streams),
      audioStream: first(this.audioInputSource?.streams),
      ffmpegState,
      desiredState,
      desiredAudioState: this.audioInputSource?.desiredState,
      pipelineSteps: [],
      filterChain: new FilterChain(),
      decoder: this.decoder,
      hasWatermark: !!this.watermarkInputSource,
      hasSubtitleOverlay: false, // TODO:
      is10BitOutput: (desiredState.pixelFormat?.bitDepth ?? 8) === 10,
      shouldDeinterlace: desiredState.deinterlaced,
      isIntelVaapiOrQsv: false,
    };

    this.context.pipelineSteps = [
      ...this.getThreadCountOption(desiredState, ffmpegState),
      new NoStdInOption(),
      new HideBannerOption(),
      new NoStatsOption(),
      new LogLevelOption(),
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

    if (isNull(this.nullableVideoInputSource)) {
      throw new Error('FFmpeg pipeline currently requires a video input');
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
      if (desiredState.videoFormat === VideoFormats.Copy) {
        this.context.pipelineSteps.push(new CopyVideoEncoder());
      } else {
        this.buildVideoPipeline();
      }
    }

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
        this.watermarkInputSource,
        this.context.filterChain,
      ),
    );

    if (isNull(this.audioInputSource)) {
      this.pipelineSteps.push(new CopyAudioEncoder());
    }

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

  protected buildVideoPipeline() {
    this.setHardwareAccelState();
    if (isVideoPipelineContext(this.context)) {
      this.decoder = this.setupDecoder();
    }

    this.setRealtime();

    if (
      this.desiredState.videoFormat !== VideoFormats.Copy &&
      this.desiredState.frameRate
    ) {
      this.pipelineSteps.push(
        FrameRateOutputOption(this.desiredState.frameRate),
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

    this.pipelineSteps.push(
      AudioChannelsOutputOption(
        this.context.audioStream.codec,
        this.context.audioStream.channels,
        this.context.desiredAudioState.audioChannels,
      ),
    );

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
      this.audioInputSource?.filterSteps.push(new AudioFirstPtsFilter(0));
    }

    if (!isNull(this.context.desiredAudioState.audioDuration)) {
      this.audioInputSource?.filterSteps.push(
        AudioPadFilter.create(this.context.desiredAudioState.audioDuration),
      );
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
      .with(VideoFormats.Copy, () => new CopyVideoEncoder())
      .with(P._, () => new ImplicitVideoEncoder())
      .exhaustive();
  }

  protected setupDecoder(): Nullable<Decoder> {
    let decoder: Nullable<Decoder> = null;
    if (isVideoPipelineContext(this.context)) {
      decoder = DecoderFactory.getSoftwareDecoder(this.context.videoStream);
      this.videoInputSource.addOption(decoder);
    }
    this.context.decoder = decoder;
    return decoder;
  }

  protected setHardwareAccelState() {
    this.context.ffmpegState.decoderHwAccelMode = 'none';
    this.context.ffmpegState.encoderHwAccelMode = 'none';
  }

  protected setStreamSeek() {
    if (this.ffmpegState.start && +this.ffmpegState.start > 0) {
      const option = new StreamSeekInputOption(this.ffmpegState.start);
      this.audioInputSource?.addOption(option);
      this.videoInputSource.addOption(option);
    }
  }

  protected setRealtime() {
    const initialBurst = this.desiredState.realtime ? 0 : 45;
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
              this.context.videoStream?.frameRate,
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
    }

    if (this.ffmpegState.outputFormat.type !== OutputFormatTypes.Hls) {
      switch (this.ffmpegState.outputLocation) {
        case OutputLocation.Stdout:
          this.pipelineSteps.push(PipeProtocolOutputOption());
          break;
      }
    }
  }

  protected getThreadCountOption(
    desiredState: FrameState,
    ffmpegState: FfmpegState,
  ) {
    let threadCount: Nullable<number> = null;
    if (
      ffmpegState.decoderHwAccelMode !== 'none' ||
      ffmpegState.encoderHwAccelMode !== 'none'
    ) {
      threadCount = 1;
    } else if (isNonEmptyString(ffmpegState.start) && desiredState.realtime) {
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

  protected getEncoderStep() {
    return find(
      this.pipelineSteps,
      (step): step is Encoder => step instanceof Encoder,
    );
  }
}
