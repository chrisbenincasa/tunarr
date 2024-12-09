import { FilterOption } from '@/ffmpeg/builder/filter/FilterOption.ts';
import { FrameState } from '@/ffmpeg/builder/state/FrameState.ts';
import { FrameDataLocation } from '@/ffmpeg/builder/types.ts';

export class YadifCudaFilter extends FilterOption {
  readonly filter: string;
  readonly affectsFrameState: boolean = true;

  constructor(currentState: FrameState) {
    super();
    this.filter = this.generateFilter(currentState);
  }

  nextState(currentState: FrameState): FrameState {
    return currentState.update({
      deinterlaced: false,
      frameDataLocation: FrameDataLocation.Hardware,
    });
  }

  private generateFilter(currentState: FrameState) {
    let filter = 'yadif_cuda';
    if (currentState.frameDataLocation !== FrameDataLocation.Hardware) {
      filter = `hwupload,${filter}`;
    }
    return filter;
  }
}
