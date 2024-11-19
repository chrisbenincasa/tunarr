import { FilterOption } from '@/ffmpeg/builder/filter/FilterOption.ts';
import { FrameState } from '@/ffmpeg/builder/state/FrameState.ts';
import { FrameSize } from '@/ffmpeg/builder/types.ts';
import { isNonEmptyString } from '@/util/index.ts';

export class ScaleVaapiFilter extends FilterOption {
  constructor(
    private currentState: FrameState,
    private scaledSize: FrameSize,
    private paddedSize: FrameSize,
  ) {
    super();
  }

  public get filter(): string {
    let scale = '';

    if (this.currentState.scaledSize.equals(this.scaledSize)) {
      if (this.currentState.pixelFormat) {
        scale = `scale_vaapi=format=${this.currentState.pixelFormat.ffmpegName}`;
      }
    } else {
      let aspectRatio = '';
      if (!this.scaledSize.equals(this.paddedSize)) {
        // Set cropped size
      }

      let squareScale = '';
      const targetSize = `${this.paddedSize.width}:${this.paddedSize.height}`;
      let format = '';
      if (this.currentState.pixelFormat) {
        format = `:format=${this.currentState.pixelFormat.ffmpegName}`;
      }

      // anamorphic edge case? what is this?

      if (this.currentState.isAnamorphic) {
        squareScale = `scale_vaapi=iw*sar:ih${format},setsar=1`;
      } else {
        aspectRatio += ',setsar=1';
      }

      scale = `${squareScale}scale_vaapi=${targetSize}:force_divisible_by=2${format}${aspectRatio}`;
    }

    if (this.currentState.frameDataLocation === 'hardware') {
      return scale;
    }

    if (isNonEmptyString(scale)) {
      return `format=nv12|p010le|vaapi,hwupload,${scale}`;
    }

    return '';
  }
}
