import { FilterOption } from '@/ffmpeg/builder/filter/FilterOption.js';
import type { PixelFormat } from '@/ffmpeg/builder/format/PixelFormat.js';
import {
  HardwarePixelFormat,
  KnownPixelFormats,
  PixelFormatCuda,
  PixelFormatNv12,
  PixelFormatP010,
  PixelFormats,
  PixelFormatYuv420P,
} from '@/ffmpeg/builder/format/PixelFormat.js';
import type { FrameState } from '@/ffmpeg/builder/state/FrameState.js';
import type { Nullable } from '@/types/util.js';
import { FrameDataLocation } from '../../types.ts';

export class HardwareDownloadCudaFilter extends FilterOption {
  public affectsFrameState: boolean = true;
  private outPixelFormat: Nullable<PixelFormat> = null;

  constructor(
    private currentPixelFormat: Nullable<PixelFormat>,
    private targetPixelFormat: Nullable<PixelFormat>,
  ) {
    super();
  }

  get filter() {
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
      if (currentFmt.bitDepth === 10) {
        formats.push(PixelFormats.P010);
        this.outPixelFormat = new PixelFormatP010();
      } else {
        formats.push(PixelFormats.NV12);
        this.outPixelFormat = new PixelFormatNv12(new PixelFormatYuv420P());
      }

      if (
        currentFmt instanceof HardwarePixelFormat &&
        !this.targetPixelFormat
      ) {
        const target = currentFmt.unwrap();
        if (target) {
          formats.push(target.name);
          this.outPixelFormat =
            KnownPixelFormats.forPixelFormat(target.name) ?? null;
        }
      } else if (this.targetPixelFormat) {
        formats.push(this.targetPixelFormat.name);
        this.outPixelFormat =
          KnownPixelFormats.forPixelFormat(this.targetPixelFormat.name) ?? null;
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
