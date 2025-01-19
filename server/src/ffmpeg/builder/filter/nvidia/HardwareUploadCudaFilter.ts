import { FilterOption } from '@/ffmpeg/builder/filter/FilterOption.js';
import { FrameState } from '@/ffmpeg/builder/state/FrameState.js';
import { FrameDataLocation } from '../../types.ts';

export class HardwareUploadCudaFilter extends FilterOption {
  public affectsFrameState: boolean = true;

  constructor(private currentState: FrameState) {
    super();
  }

  get filter() {
    if (this.currentState.frameDataLocation === FrameDataLocation.Hardware) {
      return '';
    } else {
      return 'hwupload_cuda';
    }
  }

  nextState(currentState: FrameState): FrameState {
    return currentState.updateFrameLocation(FrameDataLocation.Hardware);
  }
}
