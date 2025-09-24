import type { FfmpegState } from '@/ffmpeg/builder/state/FfmpegState.js';
import type { FrameState } from '@/ffmpeg/builder/state/FrameState.js';
import { FilterOption } from './FilterOption.ts';

export class DeinterlaceFilter extends FilterOption {
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
    return currentState.update({
      deinterlace: false,
      frameDataLocation: 'software',
    });
  }

  private generateFilter(): string {
    const filter =
      this.ffmpegState.softwareDeinterlaceFilter === 'none'
        ? 'yadif=1'
        : this.ffmpegState.softwareDeinterlaceFilter;
    if (this.currentState.frameDataLocation === 'hardware') {
      return `hwdownload,${filter}`;
    }
    return filter;
  }
}
