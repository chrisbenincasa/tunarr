import { InputSource } from '@/ffmpeg/builder/input/InputSource.ts';
import { FrameState } from '@/ffmpeg/builder/state/FrameState.ts';
import { InputOptionPipelineStep } from '@/ffmpeg/builder/types/PipelineStep.ts';

export abstract class InputOption implements InputOptionPipelineStep {
  readonly type = 'input';

  readonly affectsFrameState: boolean = false;

  abstract appliesToInput(input: InputSource): boolean;

  abstract options(inputSource: InputSource): string[];

  nextState(currentState: FrameState) {
    return currentState;
  }
}
