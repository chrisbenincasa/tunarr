import { PixelFormat } from '../../format/PixelFormat.ts';
import { FrameState } from '../../state/FrameState.ts';
import { FilterOption } from '../FilterOption.ts';

export class VaapiFormatFilter extends FilterOption {
  constructor(private pixelFormat: PixelFormat) {
    super();
  }

  get filter() {
    return `scale_vaapi=format=${this.pixelFormat.ffmpegName}`;
  }

  nextState(currentState: FrameState): FrameState {
    return currentState.update({ pixelFormat: this.pixelFormat });
  }
}
