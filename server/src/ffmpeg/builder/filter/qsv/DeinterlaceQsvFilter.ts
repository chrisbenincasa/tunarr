import { FilterOption } from '@/ffmpeg/builder/filter/FilterOption.js';
import type { FrameState } from '@/ffmpeg/builder/state/FrameState.js';
import { FrameDataLocation } from '../../types.ts';
import { HardwareUploadQsvFilter } from './HardwareUploadQsvFilter.ts';

export class DeinterlaceQsvFilter extends FilterOption {
  readonly filter: string;

  constructor(currentState: FrameState) {
    super();
    this.filter = this.generateFilter(currentState);
  }

  readonly affectsFrameState: boolean = true;

  nextState(currentState: FrameState): FrameState {
    return currentState.update({
      deinterlace: false,
      frameDataLocation: FrameDataLocation.Hardware,
    });
  }

  private generateFilter(currentState: FrameState): string {
    const prelude =
      currentState.frameDataLocation !== FrameDataLocation.Hardware
        ? `${new HardwareUploadQsvFilter(64).filter},`
        : '';
    return `${prelude}deinterlace_qsv`;
  }
}
