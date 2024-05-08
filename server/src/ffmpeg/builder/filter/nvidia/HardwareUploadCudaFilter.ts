import { FrameState } from '../../state/FrameState';
import { Filter } from '../FilterBase';

export class HardwareUploadCudaFilter extends Filter {
  public affectsFrameState: boolean = true;

  constructor(private currentState: FrameState) {
    super();
  }

  get filter() {
    if (this.currentState.frameDataLocation === 'hardware') {
      return '';
    } else {
      return 'hwupload_cuda';
    }
  }

  nextState(currentState: FrameState): FrameState {
    return currentState.update({
      frameDataLocation: 'hardware',
    });
  }
}
