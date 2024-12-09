import { FilterOption } from '@/ffmpeg/builder/filter/FilterOption.ts';
import { PixelFormat } from '@/ffmpeg/builder/format/PixelFormat.ts';
import { FrameState } from '@/ffmpeg/builder/state/FrameState.ts';

export class VaapiFormatFilter extends FilterOption {
  constructor(
    private pixelFormat: PixelFormat,
    private extraHardwareFrames: number = 64,
  ) {
    super();
  }

  get filter() {
    return `scale_vaapi=format=${this.hardarePixelFormat.name}:extra_hw_frames=${this.extraHardwareFrames}`;
  }

  nextState(currentState: FrameState): FrameState {
    return currentState.update({ pixelFormat: this.hardarePixelFormat });
  }

  private get hardarePixelFormat() {
    return this.pixelFormat.toHardwareFormat() ?? this.pixelFormat;
  }
}
