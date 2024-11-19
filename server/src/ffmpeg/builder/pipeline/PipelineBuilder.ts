import { ConcatInputSource } from '@/ffmpeg/builder/input/ConcatInputSource.ts';
import { FfmpegState } from '@/ffmpeg/builder/state/FfmpegState.ts';
import { FrameState } from '@/ffmpeg/builder/state/FrameState.ts';
import { Nullable } from '@/types/util.ts';
import { Pipeline } from './Pipeline.ts';

export interface PipelineBuilder {
  validate(): Nullable<Error>;
  hlsConcat(input: ConcatInputSource, state: FfmpegState): Pipeline;
  build(currentState: FfmpegState, desiredState: FrameState): Pipeline;
}
