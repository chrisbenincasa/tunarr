import { FilterOption } from '@/ffmpeg/builder/filter/FilterOption.js';
import type { FrameState } from '@/ffmpeg/builder/state/FrameState.js';
import { FrameDataLocation } from '@/ffmpeg/builder/types.js';

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
