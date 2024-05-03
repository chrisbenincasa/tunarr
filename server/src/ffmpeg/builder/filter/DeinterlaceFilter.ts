import { FfmpegState } from '../state/FfmpegState';
import { FrameState } from '../state/FrameState';
import { Filter } from './FilterBase';

export class DeinterlaceFilter extends Filter {
  readonly filter: string;

  affectsFrameState: boolean = true;

  constructor(
    private ffmpegState: FfmpegState,
    private currentState: FrameState,
  ) {
    super();
    this.filter = this.generateFilter();
  }

  nextState(currentState: FrameState): FrameState {
    return {
      ...currentState,
      interlaced: false,
      frameDataLocation: 'software',
    };
  }

  private generateFilter(): string {
    const filter = this.ffmpegState.softwareDeinterlaceFilter;
    if (this.currentState.frameDataLocation === 'hardware') {
      return `hwdownload,${filter}`;
    }
    return filter;
  }
}
