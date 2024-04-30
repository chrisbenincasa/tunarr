import { first, isNull, isUndefined } from 'lodash-es';
import { Nullable } from '../../../types/util';
import { ifDefined, isNonEmptyString } from '../../../util';
import { AudioStream, VideoStream } from '../MediaStream';
import { OutputFormats, VideoFormats } from '../constants';
import { Decoder } from '../decoder/Decoder';
import { DecoderFactory } from '../decoder/DecoderFactory';
import { AudioEncoder } from '../encoder/BaseEncoder';
import { CopyAudioEncoder, CopyVideoEncoder } from '../encoder/CopyEncoders';
import { EncoderFactory } from '../encoder/EncoderFactory';
import { AudioPadFilter } from '../filter/AudioPadFilter';
import { ComplexFilter } from '../filter/ComplexFilter';
import { VideoEncoder } from '../encoder/BaseEncoder';
import { FilterChain } from '../filter/FilterChain';
import {
  AudioBitrateOutputOption,
  AudioBufferSizeOutputOption,
  AudioChannelsOutputOption,
  AudioSampleRateOutputOption,
} from '../options/AudioOutputOptions';
import {
  HideBannerOption,
  NoStdInOption,
  ThreadCountOption,
} from '../options/GlobalOption';
import {
  RealtimeInputOption,
  StreamSeekInputOption,
} from '../options/InputOption';
import { LogLevelOption } from '../options/LogLevelOption';
import { NoStatsOption } from '../options/NoStatsOption';
import {
  ClosedGopOutputOption,
  FrameRateOutputOption,
  MatroskaOutputFormatOption,
  MpegTsOutputFormatOption,
  NoDemuxDecodeDelayOutputOption,
  PipeProtocolOutputOption,
  VideoBitrateOutputOption,
  VideoBufferSizeOutputOption,
  VideoTrackTimescaleOutputOption,
} from '../options/OutputOption';
import { AudioState } from '../state/AudioState';
import { FfmpegState } from '../state/FfmpegState';
import { FrameState } from '../state/FrameState';
import {
  AudioInputSource,
  PipelineStep,
  VideoInputSource,
  WatermarkInputSource,
} from '../types';
import { PipelineBuilder } from './PipelineBuilder';
import { MarkRequired } from 'ts-essentials';
import { Logger, LoggerFactory } from '../../../util/logging/LoggerFactory';

// Args passed to each setter -- we use an object here so we
// 1. can deconstruct args in each implementor to use only what we need
// 2. easily add more (does not affect argument list)
export type PipelineVideoFunctionArgs = {
  videoStream: VideoStream;
  ffmpegState: FfmpegState;
  desiredState: FrameState;
  pipelineSteps: PipelineStep[];
  filterChain: FilterChain;
  decoder: Nullable<Decoder>;
};

export type PipelineAudioFunctionArgs = {
  audioStream: AudioStream;
  ffmpegState: FfmpegState;
  desiredState: AudioState;
  pipelineSteps: PipelineStep[];
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
  protected logger: Logger = LoggerFactory.child({ caller: import.meta });
  protected decoder: Nullable<Decoder> = null;
  protected context: PipelineBuilderContext;

  constructor(
    protected videoInputFile: VideoInputSource,
    private audioInputFile: Nullable<AudioInputSource>,
    protected watermarkInputSource: Nullable<WatermarkInputSource>,
  ) {}

  validate(): Nullable<Error> {
    return null;
  }

  // build(ffmpegState: FfmpegState, desiredState: FrameState): PipelineStep[] {
  //   return context.run({ffmpegState, desiredState}, () => {
  //     return this.buildInternal();
  //   })
  // }

  build(ffmpegState: FfmpegState, desiredState: FrameState): PipelineStep[] {
    this.context = {
      videoStream: first(this.videoInputFile.videoStreams),
      audioStream: first(this.audioInputFile?.audioStreams),
      ffmpegState,
      desiredState,
      desiredAudioState: this.audioInputFile?.desiredState,
      pipelineSteps: [],
      filterChain: new FilterChain(),
      decoder: this.decoder,
    };

    this.context.pipelineSteps = [
      ...this.getThreadCountOption(desiredState, ffmpegState),
      new NoStdInOption(),
      new HideBannerOption(),
      new NoStatsOption(),
      new LogLevelOption(),

      NoDemuxDecodeDelayOutputOption(),
      ClosedGopOutputOption(),
    ];

    if (isVideoPipelineContext(this.context)) {
      if (desiredState.videoFormat === VideoFormats.Copy) {
        this.context.pipelineSteps.push(CopyVideoEncoder.create());
      } else {
        this.buildVideoPipeline();
      }
    }

    if (isNull(this.audioInputFile)) {
      this.context.pipelineSteps.push(new CopyAudioEncoder());
    } else if (this.audioInputFile.audioStreams.length > 0) {
      this.buildAudioPipeline();
    }

    // metadata

    this.setOutputFormat();

    this.pipelineSteps.push(
      new ComplexFilter(
        this.videoInputFile,
        this.audioInputFile,
        this.watermarkInputSource,
        this.context.filterChain,
      ),
    );

    if (isNull(this.audioInputFile)) {
      this.pipelineSteps.push(new CopyAudioEncoder());
    }

    return this.pipelineSteps;
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
    ifDefined(this.desiredState.frameRate, (fr) =>
      this.pipelineSteps.push(FrameRateOutputOption(fr)),
    );
    ifDefined(this.desiredState.videoTrackTimescale, (ts) =>
      this.pipelineSteps.push(VideoTrackTimescaleOutputOption(ts)),
    );
    ifDefined(this.desiredState.videoBitrate, (br) =>
      this.pipelineSteps.push(VideoBitrateOutputOption(br)),
    );
    ifDefined(this.desiredState.videoBufferSize, (bs) =>
      this.pipelineSteps.push(VideoBufferSizeOutputOption(bs)),
    );

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

    ifDefined(this.context.desiredAudioState.audioBitrate, (br) =>
      this.pipelineSteps.push(AudioBitrateOutputOption(br)),
    );

    ifDefined(this.context.desiredAudioState.audioBufferSize, (buf) =>
      this.pipelineSteps.push(AudioBufferSizeOutputOption(buf)),
    );

    ifDefined(this.context.desiredAudioState.audioSampleRate, (rate) =>
      this.pipelineSteps.push(AudioSampleRateOutputOption(rate)),
    );

    // TODO Audio volumne

    if (!isNull(this.context.desiredAudioState.audioDuration)) {
      this.audioInputFile?.filterSteps.push(
        AudioPadFilter.create(this.context.desiredAudioState.audioDuration),
      );
    }
  }

  protected abstract setupVideoFilters(): void;

  protected setupEncoder(currentState: FrameState): {
    nextState: FrameState;
    encoder: Nullable<VideoEncoder>;
  } {
    if (!isVideoPipelineContext(this.context)) {
      return { nextState: currentState, encoder: null };
    }

    const encoder = EncoderFactory.getSoftwareEncoder(
      this.context.desiredState.videoFormat,
    );
    const nextState = encoder.updateFrameState(currentState);
    return {
      nextState,
      encoder,
    };
  }

  protected setupDecoder(): Nullable<Decoder> {
    let decoder: Nullable<Decoder> = null;
    if (isVideoPipelineContext(this.context)) {
      decoder = DecoderFactory.getSoftwareDecoder(this.context.videoStream);
      this.videoInputFile.addOption(decoder);
    }
    this.context.decoder = decoder;
    return decoder;
  }

  protected setHardwareAccelState() {
    this.context.ffmpegState.decoderHwAccelMode = 'none';
    this.context.ffmpegState.encoderHwAccelMode = 'none';
  }

  protected setStreamSeek() {
    ifDefined(this.context.ffmpegState.start, (start) => {
      const option = new StreamSeekInputOption(start);
      this.audioInputFile?.addOption(option);
      this.videoInputFile.addOption(option);
    });
  }

  protected setRealtime() {
    if (this.desiredState.realtime) {
      const option = new RealtimeInputOption();
      this.audioInputFile?.addOption(option);
      this.videoInputFile.addOption(option);
    }
  }

  protected setOutputFormat() {
    this.context.pipelineSteps.push(
      this.context.ffmpegState.outputFormat === OutputFormats.Mkv
        ? MatroskaOutputFormatOption()
        : MpegTsOutputFormatOption(),
      PipeProtocolOutputOption(),
    );
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
}
