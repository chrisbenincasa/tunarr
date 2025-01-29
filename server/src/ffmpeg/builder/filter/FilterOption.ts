import type { FrameState } from '@/ffmpeg/builder/state/FrameState.js';
import type {
  FilterOptionPipelineStep,
  HasFilterOption,
} from '../types/PipelineStep.ts';

export abstract class FilterOption
  implements FilterOptionPipelineStep, HasFilterOption
{
  public readonly type = 'filter';

  public readonly affectsFrameState: boolean = false;
  public abstract readonly filter: string;

  nextState(currentState: FrameState): FrameState {
    return currentState;
  }

  options(): string[] {
    return [this.filter];
  }
}
