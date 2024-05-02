import { FrameState } from '../../state/FrameState';
import { FilterBase } from '../FilterBase';

export class YadifCudaFilter extends FilterBase {
  readonly filter: string;
  readonly affectsFrameState: boolean = true;

  constructor(currentState: FrameState) {
    super();
    this.filter = this.generateFilter(currentState);
  }

  nextState(currentState: FrameState): FrameState {
    return {
      ...currentState,
      interlaced: false,
      frameDataLocation: 'hardware',
    };
  }

  private generateFilter(currentState: FrameState) {
    let filter = 'yadif_cuda';
    if (currentState.frameDataLocation !== 'hardware') {
      filter = `hwupload,${filter}`;
    }
    return filter;
  }
}
