import { Nullable } from '../../../types/util';
import { FfmpegState } from '../state/FfmpegState';
import { FrameState } from '../state/FrameState';
import { PipelineStep } from '../types';

export interface PipelineBuilder {
  validate(): Nullable<Error>;
  build(currentState: FfmpegState, desiredState: FrameState): PipelineStep[];
}
