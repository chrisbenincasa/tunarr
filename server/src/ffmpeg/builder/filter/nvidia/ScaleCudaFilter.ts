import { FilterOption } from '@/ffmpeg/builder/filter/FilterOption.js';
import type { FrameState } from '@/ffmpeg/builder/state/FrameState.js';
import type { FrameSize } from '@/ffmpeg/builder/types.js';
import { FrameDataLocation } from '@/ffmpeg/builder/types.js';
import { isNonEmptyString } from '@tunarr/shared/util';
import { isEmpty } from 'lodash-es';
import type { Maybe } from '../../../../types/util.ts';
import type {
  PixelFormat,
  ValidPixelFormatName,
} from '../../format/PixelFormat.ts';
import { PixelFormats } from '../../format/PixelFormat.ts';
import { HardwareUploadCudaFilter } from './HardwareUploadCudaFilter.ts';

export class ScaleCudaFilter extends FilterOption {
  public filter: string;
  readonly affectsFrameState: boolean = true;

  private uploadFilter: Maybe<HardwareUploadCudaFilter>;
  private changedPixelFormat = false;

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
    private passthrough: boolean = false,
  ) {
    super();
    this.filter = this.generateFilter();
  }

  static formatOnly(
    currentState: FrameState,
    targetPixelFormat: PixelFormat,
    passthrough: boolean = false,
  ) {
    return new ScaleCudaFilter(
      currentState.update({ pixelFormat: targetPixelFormat }),
      currentState.scaledSize,
      currentState.paddedSize,
      passthrough,
    );
  }

  nextState(currentState: FrameState): FrameState {
    let nextState = this.uploadFilter?.nextState(currentState) ?? currentState;
    nextState = currentState.update({
      scaledSize: this.scaledSize,
      paddedSize: this.scaledSize,
      frameDataLocation: FrameDataLocation.Hardware,
      // this filter always outputs square pixels
      isAnamorphic: false,
    });

    const targetPixelFormat = this.supportedPixelFormat;
    if (targetPixelFormat && this.changedPixelFormat) {
      nextState = nextState.update({
        pixelFormat: targetPixelFormat,
      });
    }

    return nextState;
  }

  protected generateFilter(): string {
    let scale: string = '';

    if (this.currentState.scaledSize.equals(this.scaledSize)) {
      const targetPixelFormat = this.supportedPixelFormat;
      if (targetPixelFormat) {
        this.changedPixelFormat = true;
        const passthrough = this.passthrough ? ':passthrough=1' : '';
        scale = `${this.filterName}=format=${targetPixelFormat.name}${passthrough}`;
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
        this.changedPixelFormat = true;
        format = `:format=${targetPixelFormat.name}`;
      }

      if (this.currentState.isAnamorphic) {
        squareScale = `${this.filterName}=iw*sar:ih,setsar=1,`;
      } else {
        aspectRatio += `,setsar=1`;
      }

      scale = `${squareScale}${this.filterName}=${targetSize}${format}${aspectRatio}`;
    }

    if (isEmpty(scale)) {
      return scale;
    }

    const filters = [scale];
    if (this.currentState.frameDataLocation === FrameDataLocation.Software) {
      this.uploadFilter = new HardwareUploadCudaFilter(this.currentState);
      console.log('apply upload filter');
      filters.unshift(this.uploadFilter.filter);
    }

    return filters.filter((f) => isNonEmptyString(f)).join(',');
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

  protected filterName = 'scale_cuda';
}
