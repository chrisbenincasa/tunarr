import { PixelFormat } from '@/ffmpeg/builder/format/PixelFormat.ts';
import { FrameState } from '@/ffmpeg/builder/state/FrameState.ts';
import { FilterOption } from './FilterOption.ts';

export class PixelFormatFilter extends FilterOption {
  public affectsFrameState: boolean = true;
  public readonly filter: string;

  constructor(private pixelFormat: PixelFormat) {
    super();
    this.filter = `format=${pixelFormat.ffmpegName}`;
  }

  nextState(currentState: FrameState): FrameState {
    return currentState.update({
      pixelFormat: this.pixelFormat,
    });
  }
}
