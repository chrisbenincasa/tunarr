import { FilterOption } from '@/ffmpeg/builder/filter/FilterOption.ts';
import { PixelFormat } from '@/ffmpeg/builder/format/PixelFormat.ts';
import { FrameState } from '@/ffmpeg/builder/state/FrameState.ts';

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
