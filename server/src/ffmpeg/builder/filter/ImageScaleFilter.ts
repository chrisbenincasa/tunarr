import type { FrameState } from '../state/FrameState.ts';
import type { FrameSize } from '../types.ts';
import { FrameDataLocation } from '../types.ts';
import { FilterOption } from './FilterOption.ts';

export class ImageScaleFilter extends FilterOption {
  constructor(private scaleSize: FrameSize) {
    super();
  }

  get filter() {
    // TODO: ensure even
    return `scale=${this.scaleSize.width}:${this.scaleSize.height}:force_original_aspect_ratio=decrease`;
  }

  nextState(currentState: FrameState): FrameState {
    return currentState.update({
      scaledSize: this.scaleSize,
      paddedSize: this.scaleSize,
      frameDataLocation: FrameDataLocation.Software,
    });
  }
}
