import { FrameState } from '../../state/FrameState';
import { Filter } from '../FilterBase';

export class DeinterlaceQsvFilter extends Filter {
  readonly filter: string;

  constructor(currentState: FrameState) {
    super();
    this.filter = this.generateFilter(currentState);
  }

  readonly affectsFrameState: boolean = true;

  nextState(currentState: FrameState): FrameState {
    return {
      ...currentState,
      interlaced: false,
      frameDataLocation: 'hardware',
    };
  }

  private generateFilter(currentState: FrameState): string {
    const prelude =
      currentState.frameDataLocation === 'hardware'
        ? 'hwupload=extra_hw_frames=64,'
        : '';
    return `${prelude}deinterlace_qsv`;
  }
}
