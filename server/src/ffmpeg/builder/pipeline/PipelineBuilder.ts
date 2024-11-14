import { Nullable } from '../../../types/util.ts';
import { ConcatInputSource } from '../input/ConcatInputSource.ts';
import { FfmpegState } from '../state/FfmpegState.ts';
import { FrameState } from '../state/FrameState.ts';
import { Pipeline } from './Pipeline.ts';

export interface PipelineBuilder {
  validate(): Nullable<Error>;
  hlsConcat(input: ConcatInputSource, state: FfmpegState): Pipeline;
  build(currentState: FfmpegState, desiredState: FrameState): Pipeline;
}
