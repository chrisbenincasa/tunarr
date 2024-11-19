import { FilterOption } from '@/ffmpeg/builder/filter/FilterOption.ts';
import { PixelFormat } from '@/ffmpeg/builder/format/PixelFormat.ts';
import { FrameState } from '@/ffmpeg/builder/state/FrameState.ts';

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
