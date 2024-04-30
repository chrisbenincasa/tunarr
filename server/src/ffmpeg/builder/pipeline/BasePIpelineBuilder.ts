import { isNull } from 'lodash-es';
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
import os from 'node:os';

const numProcessors = os.cpus().length;

export abstract class BasePipelineBuilder implements PipelineBuilder {
  constructor(
    protected videoInputFile: VideoInputFile,
    private audioInputFile: Nullable<AudioInputFile>,
  ) {}

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

    if (desiredState.videoFormat === VideoFormats.Copy) {
      steps.push(new CopyVideoEncoder());
    }

    if (isNull(this.audioInputFile)) {
      steps.push(new CopyAudioEncoder());
    }

    return steps;
  }
}
