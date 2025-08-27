import type { ConcatInputSource } from '@/ffmpeg/builder/input/ConcatInputSource.js';
import type {
  FfmpegState,
  PipelineOptions,
} from '@/ffmpeg/builder/state/FfmpegState.js';
import type { FrameState } from '@/ffmpeg/builder/state/FrameState.js';
import type { Nullable } from '@/types/util.js';
import type { Pipeline } from './Pipeline.ts';

export interface PipelineBuilder {
  validate(): Nullable<Error>;

  /**
   * Takes input source in ffconcat format and returns the concatenated output stream
   * in the given output format. Simply copies input streams.
   * @param input
   * @param state
   */
  concat(input: ConcatInputSource, state: FfmpegState): Pipeline;

  /**
   * Takes m3u8 HLS playlist as input and returns a continuous output stream
   * in the given output format. Simple copies input streams.
   * @param input
   * @param state
   */
  hlsWrap(input: ConcatInputSource, state: FfmpegState): Pipeline;

  /**
   * Calculates an ffmpeg pipeline using the inputted ffmpeg state and desired
   * output state.
   * @param currentState
   * @param desiredState
   */
  build(
    currentState: FfmpegState,
    desiredState: FrameState,
    pipelineOptions: PipelineOptions,
  ): Pipeline;
}
