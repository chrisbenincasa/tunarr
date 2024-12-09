import { HardwareDownloadFilter } from '@/ffmpeg/builder/filter/HardwareDownloadFilter.ts';
import { FrameState } from '@/ffmpeg/builder/state/FrameState.ts';
import { FrameDataLocation, FrameSize } from '@/ffmpeg/builder/types.ts';
import { isNonEmptyString } from '@/util/index.ts';
import { FilterOption } from './FilterOption.ts';

export class PadFilter extends FilterOption {
  private desiredPaddedSize: FrameSize;

  public readonly filter: string;
  public readonly affectsFrameState: boolean = true;

  constructor(
    private currentState: FrameState,
    desiredState: FrameState,
  ) {
    super();
    this.desiredPaddedSize = desiredState.paddedSize;
    this.filter = this.generateFilter();
  }

  nextState(currentState: FrameState): FrameState {
    return currentState.update({
      paddedSize: this.desiredPaddedSize,
      frameDataLocation: FrameDataLocation.Software,
    });
  }

  private generateFilter(): string {
    const pad = `pad=${this.desiredPaddedSize.width}:${this.desiredPaddedSize.height}:-1:-1:color=black`;
    const hwDownloadPart = new HardwareDownloadFilter(this.currentState).filter;

    if (isNonEmptyString(hwDownloadPart)) {
      return `${hwDownloadPart},${pad}`;
    }

    return pad;
  }
}
