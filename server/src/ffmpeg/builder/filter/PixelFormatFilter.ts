import { PixelFormat } from '../format/PixelFormat.ts';
import { FrameState } from '../state/FrameState.ts';
import { FilterOption } from './FilterOption.ts';

export class PixelFormatFilter extends FilterOption {
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
