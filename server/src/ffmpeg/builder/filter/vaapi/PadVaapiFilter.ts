import type { FrameState } from '../../state/FrameState.ts';
import type { FrameSize } from '../../types.ts';
import { FrameDataLocation } from '../../types.ts';
import { FilterOption } from '../FilterOption.ts';
import { HardwareUploadVaapiFilter } from './HardwareUploadVaapiFilter.ts';

export class PadVaapiFilter extends FilterOption {
  private preprocessFilters: FilterOption[] = [];

  constructor(
    private currentState: FrameState,
    private paddedSize: FrameSize,
  ) {
    super();
  }

  get filter(): string {
    if (this.currentState.frameDataLocation === FrameDataLocation.Software) {
      this.preprocessFilters.push(new HardwareUploadVaapiFilter(true));
    }

    const pad = `pad_vaapi=w=${this.paddedSize.width}:h=${this.paddedSize.height}:x=-1:y=-1:color=black`;

    return this.preprocessFilters
      .map((filter) => filter.filter)
      .concat([pad])
      .join(',');
  }

  nextState(currentState: FrameState): FrameState {
    currentState = this.preprocessFilters.reduce(
      (prev, filter) => filter.nextState(prev),
      currentState,
    );
    return currentState.update({
      paddedSize: this.paddedSize,
    });
  }

  public affectsFrameState: boolean = true;
}
