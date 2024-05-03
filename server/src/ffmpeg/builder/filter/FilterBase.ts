import { Option, OptionType } from '../options/Option';
import { FrameState } from '../state/FrameState';
import { PipelineFilterStep } from './PipelineFilterStep';

export abstract class Filter implements PipelineFilterStep, Option {
  readonly type: OptionType = 'filter';
  readonly affectsFrameState: boolean = false;

  abstract readonly filter: string;

  nextState(currentState: FrameState): FrameState {
    return currentState;
  }

  options(): string[] {
    return [this.filter];
  }
}
