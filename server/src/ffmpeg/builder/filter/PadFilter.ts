import { HardwareDownloadFilter } from '@/ffmpeg/builder/filter/HardwareDownloadFilter.js';
import type { FrameState } from '@/ffmpeg/builder/state/FrameState.js';
import type { FrameSize } from '@/ffmpeg/builder/types.js';
import { FrameDataLocation } from '@/ffmpeg/builder/types.js';
import { isNonEmptyString } from '@/util/index.js';
import { FilterOption } from './FilterOption.ts';

export class PadFilter extends FilterOption {
  private desiredPaddedSize: FrameSize;
  private hwDownloadFilter: HardwareDownloadFilter;

  public readonly filter: string;
  public readonly affectsFrameState: boolean = true;

  constructor(
    private currentState: FrameState,
    desiredState: FrameState,
  ) {
    super();
    this.desiredPaddedSize = desiredState.paddedSize;
    this.hwDownloadFilter = new HardwareDownloadFilter(this.currentState);
    this.filter = this.generateFilter();
  }

  nextState(currentState: FrameState): FrameState {
    return this.hwDownloadFilter.nextState(currentState).update({
      paddedSize: this.desiredPaddedSize,
      frameDataLocation: FrameDataLocation.Software,
    });
  }

  private generateFilter(): string {
    const pad = `pad=${this.desiredPaddedSize.width}:${this.desiredPaddedSize.height}:-1:-1:color=black`;
    const hwDownloadPart = this.hwDownloadFilter.filter;

    if (isNonEmptyString(hwDownloadPart)) {
      return `${hwDownloadPart},${pad}`;
    }

    return pad;
  }
}
