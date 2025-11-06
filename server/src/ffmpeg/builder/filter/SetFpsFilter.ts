import type { FrameState } from '../state/FrameState.ts';
import { FilterOption } from './FilterOption.ts';

export class SetFpsFilter extends FilterOption {
  constructor(private frameRate: number) {
    super();
  }

  get filter(): string {
    return `fps=${this.frameRate.toString(10)}`;
  }

  nextState(currentState: FrameState): FrameState {
    return currentState.update({
      frameRate: this.frameRate,
    });
  }
}
