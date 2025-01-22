import type { InputSource } from '@/ffmpeg/builder/input/InputSource.js';
import type { FrameState } from '@/ffmpeg/builder/state/FrameState.js';
import type { InputOptionPipelineStep } from '@/ffmpeg/builder/types/PipelineStep.js';

export abstract class InputOption implements InputOptionPipelineStep {
  readonly type = 'input';

  readonly affectsFrameState: boolean = false;

  abstract appliesToInput(input: InputSource): boolean;

  abstract options(inputSource: InputSource): string[];

  nextState(currentState: FrameState) {
    return currentState;
  }
}
