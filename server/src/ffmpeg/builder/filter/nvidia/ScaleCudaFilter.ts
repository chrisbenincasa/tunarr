import { FilterOption } from '@/ffmpeg/builder/filter/FilterOption.js';
import type { FrameState } from '@/ffmpeg/builder/state/FrameState.js';
import type { FrameSize } from '@/ffmpeg/builder/types.js';
import { FrameDataLocation } from '@/ffmpeg/builder/types.js';
import { isEmpty } from 'lodash-es';
import type {
  PixelFormat,
  ValidPixelFormatName,
} from '../../format/PixelFormat.ts';
import { PixelFormats } from '../../format/PixelFormat.ts';

export class ScaleCudaFilter extends FilterOption {
  readonly filter: string;
  readonly affectsFrameState: boolean = true;

  static supportedPixelFormats: ValidPixelFormatName[] = [
    PixelFormats.YUV420P,
    PixelFormats.NV12,
    PixelFormats.YUV444P,
    PixelFormats.P010,
    PixelFormats.YUV444P16LE,
  ] as const;

  constructor(
    private currentState: FrameState,
    private scaledSize: FrameSize,
    private paddedSize: FrameSize,
  ) {
    super();
    this.filter = this.generateFilter();
  }

  static formatOnly(currentState: FrameState, targetPixelFormat: PixelFormat) {
    return new ScaleCudaFilter(
      currentState.update({ pixelFormat: targetPixelFormat }),
      currentState.scaledSize,
      currentState.paddedSize,
    );
  }

  nextState(currentState: FrameState): FrameState {
    let nextState = currentState.update({
      scaledSize: this.scaledSize,
      paddedSize: this.scaledSize,
      frameDataLocation: FrameDataLocation.Hardware,
      // this filter always outputs square pixels
      isAnamorphic: false,
    });

    const targetPixelFormat = this.supportedPixelFormat;
    if (targetPixelFormat) {
      nextState = nextState.update({
        pixelFormat: targetPixelFormat,
      });
    }

    return nextState;
  }

  private generateFilter(): string {
    let scale: string = '';

    if (this.currentState.scaledSize.equals(this.scaledSize)) {
      const targetPixelFormat = this.supportedPixelFormat;
      if (targetPixelFormat) {
        scale = `scale_cuda=format=${targetPixelFormat.name}`;
      }
    } else {
      let aspectRatio = '';
      if (!this.scaledSize.equals(this.paddedSize)) {
        aspectRatio = ':force_original_aspect_ratio=decrease';
      }

      let squareScale = '';
      const targetSize = `${this.paddedSize.width}:${this.paddedSize.height}`;
      let format = '';
      const targetPixelFormat = this.supportedPixelFormat;
      if (targetPixelFormat) {
        format = `:format=${targetPixelFormat.name}`;
      }

      if (this.currentState.isAnamorphic) {
        squareScale = `scale_cuda=iw*sar:ih,setsar=1,`;
      } else {
        aspectRatio += `,setsar=1`;
      }

      scale = `${squareScale}scale_cuda=${targetSize}${format}${aspectRatio}`;
    }

    if (isEmpty(scale)) {
      return scale;
    }

    return this.currentState.frameDataLocation === FrameDataLocation.Hardware
      ? scale
      : `hwupload_cuda,${scale}`;
  }

  private get supportedPixelFormat() {
    if (!this.currentState.pixelFormat) {
      return;
    }
    return ScaleCudaFilter.supportedPixelFormats.includes(
      this.currentState.pixelFormat.name,
    )
      ? this.currentState.pixelFormat
      : this.currentState.pixelFormat.toHardwareFormat();
  }
}
