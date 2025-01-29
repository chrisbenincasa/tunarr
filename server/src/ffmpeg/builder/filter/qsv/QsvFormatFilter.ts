import { FilterOption } from '@/ffmpeg/builder/filter/FilterOption.js';
import type { PixelFormat } from '@/ffmpeg/builder/format/PixelFormat.js';
import type { FrameState } from '@/ffmpeg/builder/state/FrameState.js';

export class QsvFormatFilter extends FilterOption {
  public affectsFrameState: boolean = true;

  constructor(private pixelFormat: PixelFormat) {
    super();
  }

  get filter() {
    return `vpp_qsv=format=${this.pixelFormat.name}`;
  }

  nextState(currentState: FrameState): FrameState {
    return currentState.update({ pixelFormat: this.pixelFormat });
  }
}
