import { FilterOption } from '@/ffmpeg/builder/filter/FilterOption.ts';
import { FrameState } from '@/ffmpeg/builder/state/FrameState.ts';

export class HardwareUploadCudaFilter extends FilterOption {
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
