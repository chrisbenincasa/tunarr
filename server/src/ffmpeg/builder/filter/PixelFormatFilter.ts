import { PixelFormat } from '../format/PixelFormat';
import { FrameState } from '../state/FrameState';
import { Filter } from './FilterBase';

export class PixelFormatFilter extends Filter {
  public affectsFrameState: boolean = true;
  public readonly filter: string;

  constructor(private pixelFormat: PixelFormat) {
    super();
    this.filter = `format=${pixelFormat.ffmpegName}`;
  }

  // TOOD: update pixel format in state
  nextState(currentState: FrameState): FrameState {
    return currentState.update({
      pixelFormat: this.pixelFormat,
    });
  }
}
