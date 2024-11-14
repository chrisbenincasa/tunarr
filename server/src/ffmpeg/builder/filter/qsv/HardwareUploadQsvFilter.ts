import { FrameState } from '../../state/FrameState.ts';
import { FrameDataLocation } from '../../types.ts';
import { FilterOption } from '../FilterOption.ts';

export class HardwareUploadQsvFilter extends FilterOption {
  constructor(private extraHardwareFrames?: number) {
    super();
  }

  get filter() {
    return `hwupload${
      this.extraHardwareFrames
        ? `=extra_hw_frames=${this.extraHardwareFrames}`
        : ''
    }`;
  }

  nextState(currentState: FrameState): FrameState {
    return currentState.updateFrameLocation(FrameDataLocation.Hardware);
  }
}
