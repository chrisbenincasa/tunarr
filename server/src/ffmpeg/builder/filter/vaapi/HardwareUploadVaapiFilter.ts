import { FrameState } from '../../state/FrameState.ts';
import { FrameDataLocation } from '../../types.ts';
import { FilterOption } from '../FilterOption.ts';

export class HardwareUploadVaapiFilter extends FilterOption {
  constructor(
    private setFormat: boolean,
    private extraHardwareFrames?: number,
  ) {
    super();
  }

  get filter() {
    const format = this.setFormat ? 'format=nv12|p010le|vaapi,' : '';
    return `${format}hwupload${
      this.extraHardwareFrames
        ? `=extra_hw_frames=${this.extraHardwareFrames}`
        : ''
    }`;
  }

  nextState(currentState: FrameState): FrameState {
    return currentState.updateFrameLocation(FrameDataLocation.Hardware);
  }
}
