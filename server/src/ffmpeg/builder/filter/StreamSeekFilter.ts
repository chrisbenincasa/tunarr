import type { Duration } from 'dayjs/plugin/duration.js';
import type { FrameState } from '../state/FrameState.ts';
import type { FilterOptionPipelineStep } from '../types/PipelineStep.ts';

export class StreamSeekFilter implements FilterOptionPipelineStep {
  readonly type = 'filter';

  constructor(private start: Duration) {}
  affectsFrameState: boolean;

  nextState(currentState: FrameState): FrameState {
    return currentState;
  }

  options(): string[] {
    return ['-ss', `${this.start.asMilliseconds()}ms`];
  }
}
