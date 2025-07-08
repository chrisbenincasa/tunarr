import { FilterOption } from '@/ffmpeg/builder/filter/FilterOption.js';
import type { FrameState } from '@/ffmpeg/builder/state/FrameState.js';
import type { FrameSize } from '@/ffmpeg/builder/types.js';
import { FrameDataLocation } from '@/ffmpeg/builder/types.js';
import { isNonEmptyString } from '@/util/index.js';
import { PixelFormats } from '../../format/PixelFormat.ts';

export class ScaleVaapiFilter extends FilterOption {
  constructor(
    private currentState: FrameState,
    private scaledSize: FrameSize,
    private paddedSize: FrameSize,
  ) {
    super();
    this.filter = this.genFilter();
  }

  public readonly filter: string;

  private genFilter(): string {
    let scale = '';

    if (this.currentState.scaledSize.equals(this.scaledSize)) {
      if (this.currentState.pixelFormat) {
        const pixelFormat =
          this.currentState.pixelFormat.toHardwareFormat()?.name ??
          this.currentState.pixelFormat.name;
        // Hardcode the extra frames for now...
        scale = `scale_vaapi=format=${pixelFormat}:extra_hw_frames=64`;
      }
    } else {
      let aspectRatio = '';
      if (!this.scaledSize.equals(this.paddedSize)) {
        // Set cropped size
        aspectRatio = ':force_original_aspect_ratio=decrease';
      }

      let squareScale = '';
      const targetSize = `${this.paddedSize.width}:${this.paddedSize.height}`;
      let format = '';
      if (this.currentState.pixelFormat) {
        const pixelFormat =
          this.currentState.pixelFormat.toHardwareFormat()?.name ??
          this.currentState.pixelFormat.name;
        format = `:format=${pixelFormat}`;
      }

      // anamorphic edge case? what is this?

      if (this.currentState.isAnamorphic) {
        squareScale = `scale_vaapi=iw*sar:ih${format}:extra_hw_frames=64,setsar=1,`;
      } else {
        aspectRatio += ',setsar=1';
      }

      scale = `${squareScale}scale_vaapi=${targetSize}:extra_hw_frames=64:force_divisible_by=2${format}${aspectRatio}`;
    }

    if (this.currentState.frameDataLocation === FrameDataLocation.Hardware) {
      return scale;
    }

    if (isNonEmptyString(scale)) {
      const formtStr = [
        PixelFormats.NV12,
        PixelFormats.P010,
        PixelFormats.VAAPI,
      ].join('|');
      return `format=${formtStr},hwupload=extra_hw_frames=64,${scale}`;
    }

    return '';
  }

  nextState(currentState: FrameState): FrameState {
    const nextState = currentState.update({
      scaledSize: this.scaledSize,
      paddedSize: this.scaledSize,
      frameDataLocation: FrameDataLocation.Hardware,
    });

    if (this.currentState.pixelFormat) {
      return nextState.update({
        pixelFormat:
          this.currentState.pixelFormat.toHardwareFormat() ??
          this.currentState.pixelFormat,
      });
    }

    return nextState;
  }
}
