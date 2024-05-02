import { constant } from 'lodash-es';
import { PipelineFilterStep } from './PipelineFilterStep';
import { FrameState } from '../state/FrameState';

export abstract class FilterBase implements PipelineFilterStep {
  abstract filter: string;

  globalOptions = constant([]);
  filterOptions = constant([]);
  outputOptions = constant([]);
  inputOptions = constant([]);

  nextState(currentState: FrameState): FrameState {
    return currentState;
  }

  affectsFrameState = false;
}
