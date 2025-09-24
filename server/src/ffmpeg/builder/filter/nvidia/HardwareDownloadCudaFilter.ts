import { FilterOption } from '@/ffmpeg/builder/filter/FilterOption.js';
import type { PixelFormat } from '@/ffmpeg/builder/format/PixelFormat.js';
import {
  HardwarePixelFormat,
  KnownPixelFormats,
  PixelFormatCuda,
} from '@/ffmpeg/builder/format/PixelFormat.js';
import type { FrameState } from '@/ffmpeg/builder/state/FrameState.js';
import type { Nullable } from '@/types/util.js';
import { FrameDataLocation } from '../../types.ts';

export class HardwareDownloadCudaFilter extends FilterOption {
  public affectsFrameState: boolean = true;
  private outPixelFormat: Nullable<PixelFormat> = null;

  constructor(
    private currentState: FrameState,
    private targetPixelFormat: Nullable<PixelFormat>,
  ) {
    super();
  }

  private get currentPixelFormat() {
    return this.currentState.pixelFormat;
  }

  get filter() {
    if (this.currentState.frameDataLocation !== FrameDataLocation.Hardware) {
      return '';
    }

    let f = 'hwdownload';
    if (this.currentPixelFormat) {
      let currentFmt = this.currentPixelFormat;
      if (this.currentPixelFormat instanceof PixelFormatCuda) {
        currentFmt = currentFmt.unwrap();
      }

      // pick the supported pixel format for hwdownload based on the
      // input. ffmpeg and hwdownload are very specific about what is accepted
      // here, even if the data was rearranged on hardware:
      // see: https://github.com/FFmpeg/FFmpeg/blob/master/libavcodec/nvdec.c#L744-L773
      // we're not going to support chromas other than 420 at this point...
      const formats: string[] = [];

      formats.push(currentFmt.name);
      this.outPixelFormat = currentFmt;

      if (currentFmt instanceof HardwarePixelFormat) {
        if (!this.targetPixelFormat) {
          const target = currentFmt.unwrap();
          if (target) {
            formats.push(target.name);
            this.outPixelFormat =
              KnownPixelFormats.forPixelFormat(target.name) ?? null;
          }
        } else {
          formats.push(this.targetPixelFormat.name);
          this.outPixelFormat = this.targetPixelFormat;
        }
      }

      for (const fmt of formats) {
        f += `,format=${fmt}`;
      }
    }

    return f;
  }

  nextState(currentState: FrameState): FrameState {
    let nextState = currentState.updateFrameLocation(
      FrameDataLocation.Software,
    );

    if (this.outPixelFormat) {
      nextState = nextState.update({
        pixelFormat: this.outPixelFormat,
      });
    }

    return nextState;
  }
}
