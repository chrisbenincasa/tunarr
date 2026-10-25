import { FilterOption } from '@/ffmpeg/builder/filter/FilterOption.js';
import { ColorFormat } from '@/ffmpeg/builder/format/ColorFormat.js';
import type { PixelFormat } from '@/ffmpeg/builder/format/PixelFormat.js';
import type { FrameState } from '@/ffmpeg/builder/state/FrameState.js';

export class VaapiFormatFilter extends FilterOption {
  constructor(
    private pixelFormat: PixelFormat,
    private extraHardwareFrames: number = 64,
    private normalizeSdrColor: boolean = false,
  ) {
    super();
  }

  get filter() {
    const colorOptions = this.normalizeSdrColor
      ? ':out_color_matrix=bt709:out_color_primaries=bt709:out_color_transfer=bt709:out_range=tv'
      : '';
    return `scale_vaapi=format=${this.hardarePixelFormat.name}:extra_hw_frames=${this.extraHardwareFrames}${colorOptions}`;
  }

  nextState(currentState: FrameState): FrameState {
    return currentState.update({
      pixelFormat: this.hardarePixelFormat,
      ...(this.normalizeSdrColor ? { colorFormat: ColorFormat.bt709 } : {}),
    });
  }

  private get hardarePixelFormat() {
    return this.pixelFormat.toHardwareFormat() ?? this.pixelFormat;
  }
}
