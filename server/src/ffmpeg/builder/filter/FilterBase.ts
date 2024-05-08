import { Option } from '../options/Option';
import { FrameState } from '../state/FrameState';
import { PipelineStepType } from '../types';
import { PipelineFilterStep } from './PipelineFilterStep';

export abstract class Filter implements PipelineFilterStep, Option {
  public readonly type: PipelineStepType = 'filter';
  public readonly affectsFrameState: boolean = false;
  public abstract readonly filter: string;

  nextState(currentState: FrameState): FrameState {
    return currentState;
  }

  options(): string[] {
    return [this.filter];
  }
}
