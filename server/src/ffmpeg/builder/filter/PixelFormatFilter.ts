import type { PixelFormat } from '@/ffmpeg/builder/format/PixelFormat.js';
import type { FrameState } from '@/ffmpeg/builder/state/FrameState.js';
import { FilterOption } from './FilterOption.ts';

export class PixelFormatFilter extends FilterOption {
  public affectsFrameState: boolean = true;
  public readonly filter: string;

  constructor(private pixelFormat: PixelFormat) {
    super();
    this.filter = `format=${pixelFormat.name}`;
  }

  nextState(currentState: FrameState): FrameState {
    return currentState.update({
      pixelFormat: this.pixelFormat,
    });
  }
}
