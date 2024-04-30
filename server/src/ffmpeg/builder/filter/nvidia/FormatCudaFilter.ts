import { PixelFormat } from '../../format/PixelFormat.ts';
import { FrameState } from '../../state/FrameState.ts';
import { FilterOption } from '../FilterOption.ts';

export class FormatCudaFilter extends FilterOption {
  public affectsFrameState: boolean = true;

  constructor(private pixelFormat: PixelFormat) {
    super();
  }

  get filter() {
    return `scale_cuda=format=${this.pixelFormat.ffmpegName}`;
  }

  nextState(currentState: FrameState): FrameState {
    return currentState.update({
      pixelFormat: this.pixelFormat,
    });
  }
}
