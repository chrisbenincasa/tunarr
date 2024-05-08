import { PixelFormat } from '../../format/PixelFormat';
import { FrameState } from '../../state/FrameState';
import { Filter } from '../FilterBase';

export class FormatCudaFilter extends Filter {
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
