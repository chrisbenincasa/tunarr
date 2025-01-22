import { FilterOption } from '@/ffmpeg/builder/filter/FilterOption.js';
import type { FrameState } from '@/ffmpeg/builder/state/FrameState.js';

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
      frameDataLocation: 'hardware',
    });
  }

  private generateFilter(currentState: FrameState): string {
    const prelude =
      currentState.frameDataLocation === 'hardware'
        ? 'hwupload=extra_hw_frames=64,'
        : '';
    return `${prelude}deinterlace_qsv`;
  }
}
