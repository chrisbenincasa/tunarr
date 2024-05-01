import { isNull } from 'lodash-es';
import os from 'node:os';
import { Nullable } from '../../../types/util';
import { VideoFormats } from '../constants';
import { CopyAudioEncoder, CopyVideoEncoder } from '../encoder/CopyEncoders';
import {
  HideBannerOption,
  NoStdInOption,
  ThreadCountOption,
} from '../options/GlobalOption';
import { LogLevelOption } from '../options/LogLevelOption';
import { NoStatsOption } from '../options/NoStatsOption';
import { FfmpegState } from '../state/FfmpegState';
import { FrameState } from '../state/FrameState';
import { AudioInputFile, PipelineStep, VideoInputFile } from '../types';
import { PipelineBuilder } from './PipelineBuilder';
import { ifDefined } from '../../../util';
import { RealtimeInputOption, StreamSeekOption } from '../options/InputOption';
import { VideoStream } from '../MediaStream';
import { Decoder } from '../decoder/Decoder';
import { DecoderFactory } from '../decoder/DecoderFactory';
import {
  FrameRateOutputOption,
  VideoBitrateOutputOption,
  VideoBufferSizeOutputOption,
  VideoTrackTimescaleOutputOption,
} from '../options/OutputOption';
import { FilterChain } from '../filter/FilterChain';

const numProcessors = os.cpus().length;

// Args passed to each setter -- we use an object here so we
// 1. can deconstruct args in each implementor to use only what we need
// 2. easily add more (does not affect argument list)
export type PipelineFunctionArgs = {
  videoStream: VideoStream;
  ffmpegState: FfmpegState;
  desiredState: FrameState;
  pipelineSteps: PipelineStep[];
  filterChain: FilterChain;
};

export abstract class BasePipelineBuilder implements PipelineBuilder {
  protected decoder: Nullable<Decoder> = null;

  constructor(
    protected videoInputFile: VideoInputFile,
    private audioInputFile: Nullable<AudioInputFile>,
  ) {}

  validate(): Nullable<Error> {
    return null;
  }

  build(currentState: FfmpegState, desiredState: FrameState): PipelineStep[] {
    const steps: PipelineStep[] = [
      desiredState.realtime
        ? new ThreadCountOption(1)
        : new ThreadCountOption(currentState.threadCount ?? numProcessors),
      new NoStdInOption(),
      new HideBannerOption(),
      new NoStatsOption(),
      new LogLevelOption(),
    ];

    if (this.videoInputFile.videoStreams.length > 0) {
      if (desiredState.videoFormat === VideoFormats.Copy) {
        steps.push(new CopyVideoEncoder());
      } else {
        this.buildVideoPipeline({
          ffmpegState: currentState,
          desiredState,
          videoStream: this.videoInputFile.videoStreams[0],
          pipelineSteps: steps,
          filterChain: new FilterChain(),
        });
      }
    }

    if (isNull(this.audioInputFile)) {
      steps.push(new CopyAudioEncoder());
    }

    return steps;
  }

  protected buildVideoPipeline(args: Readonly<PipelineFunctionArgs>) {
    this.setHardwareAccelState(args);
    this.decoder = this.setupDecoder(args);
    ifDefined(args.desiredState.frameRate, (fr) =>
      args.pipelineSteps.push(FrameRateOutputOption(fr)),
    );
    ifDefined(args.desiredState.videoTrackTimescale, (ts) =>
      args.pipelineSteps.push(VideoTrackTimescaleOutputOption(ts)),
    );
    ifDefined(args.desiredState.videoBitrate, (br) =>
      args.pipelineSteps.push(VideoBitrateOutputOption(br)),
    );
    ifDefined(args.desiredState.videoBufferSize, (bs) =>
      args.pipelineSteps.push(VideoBufferSizeOutputOption(bs)),
    );

    this.setupVideoFilters(args);
  }

  protected abstract setupVideoFilters(
    args: Readonly<PipelineFunctionArgs>,
  ): void;

  protected setupDecoder({
    videoStream,
  }: PipelineFunctionArgs): Nullable<Decoder> {
    const decoder = DecoderFactory.getSoftwareDecoder(videoStream);
    this.videoInputFile.addOption(decoder);
    return decoder;
  }

  protected setHardwareAccelState({ ffmpegState }: PipelineFunctionArgs) {
    ffmpegState.decoderHwAccelMode = 'none';
    ffmpegState.encoderHwAccelMode = 'none';
  }

  protected setStreamSeek(ffmpegState: FfmpegState) {
    ifDefined(ffmpegState.start, (start) => {
      const option = StreamSeekOption(start);
      this.audioInputFile?.addOption(option);
      this.videoInputFile.addOption(option);
    });
  }

  protected setRealtime(desiredState: FrameState) {
    if (desiredState.realtime) {
      const option = RealtimeInputOption();
      this.audioInputFile?.addOption(option);
      this.videoInputFile.addOption(option);
    }
  }
}
