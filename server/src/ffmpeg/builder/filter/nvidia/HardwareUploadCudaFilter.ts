import { FilterOption } from '@/ffmpeg/builder/filter/FilterOption.js';
import type { FrameState } from '@/ffmpeg/builder/state/FrameState.js';
import type { Maybe } from '../../../../types/util.ts';
import type { PixelFormat } from '../../format/PixelFormat.ts';
import {
  PixelFormatCuda,
  PixelFormats,
  PixelFormatYuv420P,
  PixelFormatYuv420P10Le,
} from '../../format/PixelFormat.ts';
import { FrameDataLocation } from '../../types.ts';

export class HardwareUploadCudaFilter extends FilterOption {
  private changedPixelFormat: Maybe<PixelFormat>;
  public affectsFrameState: boolean = true;

  constructor(private currentState: FrameState) {
    super();
  }

  get filter() {
    if (this.currentState.frameDataLocation === FrameDataLocation.Hardware) {
      return '';
    } else {
      let fmtPart = '';
      console.log(this.currentState);
      if (
        !this.currentState.pixelFormat ||
        this.currentState.pixelFormat.name === PixelFormats.Unknown
      ) {
        const bitDepth = this.currentState.bitDepth;
        this.changedPixelFormat =
          bitDepth === 10
            ? new PixelFormatYuv420P10Le()
            : new PixelFormatYuv420P();
        fmtPart = `format=${this.changedPixelFormat.name},`;
      }
      return `${fmtPart}hwupload_cuda`;
    }
  }

  nextState(currentState: FrameState): FrameState {
    // Nothing changed.
    if (this.currentState.frameDataLocation === FrameDataLocation.Hardware) {
      return currentState;
    }

    return currentState.update({
      frameDataLocation: FrameDataLocation.Hardware,
      pixelFormat: new PixelFormatCuda(
        this.changedPixelFormat ?? currentState.pixelFormatOrUnknown(),
      ),
    });
  }
}
