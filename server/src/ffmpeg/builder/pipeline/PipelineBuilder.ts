import { FfmpegState } from '../state/FfmpegState';
import { FrameState } from '../state/FrameState';
import { PipelineStep } from '../types';

export interface PipelineBuilder {
  build(currentState: FfmpegState, desiredState: FrameState): PipelineStep[];
}
