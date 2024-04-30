import { FrameState } from '../state/FrameState';
import { PipelineStep } from '../types';

export abstract class Option implements PipelineStep {
  // env vars
  abstract globalOptions(): string[];
  abstract filterOptions(): string[];
  abstract outputOptions(): string[];

  inputOptions(): string[] {
    return [];
  }

  nextState(currentState: FrameState): FrameState {
    return currentState;
  }
}
