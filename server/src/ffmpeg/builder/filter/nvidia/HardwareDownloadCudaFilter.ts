import { FilterOption } from '@/ffmpeg/builder/filter/FilterOption.js';
import type { PixelFormat } from '@/ffmpeg/builder/format/PixelFormat.js';
import {
  HardwarePixelFormat,
  PixelFormatCuda,
  PixelFormats,
} from '@/ffmpeg/builder/format/PixelFormat.js';
import type { FrameState } from '@/ffmpeg/builder/state/FrameState.js';
import type { Nullable } from '@/types/util.js';
import { isNull } from 'lodash-es';
import { FrameDataLocation } from '../../types.ts';

export class HardwareDownloadCudaFilter extends FilterOption {
  public affectsFrameState: boolean = true;

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
      } else {
        formats.push(PixelFormats.NV12);
      }

      if (
        currentFmt instanceof HardwarePixelFormat &&
        !this.targetPixelFormat
      ) {
        const target = currentFmt.unwrap();
        if (target) {
          formats.push(target.name);
        }
      } else if (this.targetPixelFormat) {
        formats.push(this.targetPixelFormat.name);
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

    if (!isNull(this.targetPixelFormat)) {
      return nextState.update({ pixelFormat: this.targetPixelFormat });
    }

    if (!isNull(this.currentPixelFormat)) {
      if (this.currentPixelFormat.name === PixelFormats.NV12) {
        nextState = nextState.update({
          pixelFormat: this.currentPixelFormat.unwrap(),
        });
      } else {
        nextState = nextState.update({ pixelFormat: this.currentPixelFormat });
      }
    }

    return nextState;
  }
}
