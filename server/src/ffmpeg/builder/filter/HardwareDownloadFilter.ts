import type { FrameState } from '@/ffmpeg/builder/state/FrameState.js';
import type { Maybe } from '../../../types/util.ts';
import type { PixelFormat } from '../format/PixelFormat.ts';
import {
  PixelFormatCuda,
  PixelFormatVaapi,
  PixelFormatYuv420P,
  PixelFormatYuv420P10Le,
} from '../format/PixelFormat.ts';
import { FrameDataLocation } from '../types.ts';
import { FilterOption } from './FilterOption.ts';

export class HardwareDownloadFilter extends FilterOption {
  private outputPixelFormat: Maybe<PixelFormat>;

  constructor(private currentState: FrameState) {
    super();
  }

  get filter() {
    let hwdownload = '';
    if (this.currentState.frameDataLocation === FrameDataLocation.Hardware) {
      hwdownload = 'hwdownload';
      if (this.currentState.pixelFormat) {
        if (this.currentState.pixelFormat instanceof PixelFormatVaapi) {
          // Use the hardware format of the underlying pixel format
          const underlyingFormat = this.currentState.pixelFormat
            .unwrap()
            ?.toHardwareFormat();
          this.outputPixelFormat = underlyingFormat;
          if (underlyingFormat) {
            return `hwdownload,format=vaapi|${underlyingFormat.name}`;
          }
        } else if (this.currentState.pixelFormat instanceof PixelFormatCuda) {
          // Use the hardware format of the underlying pixel format
          const underlyingFormat = this.currentState.pixelFormat
            .unwrap()
            ?.toHardwareFormat();
          this.outputPixelFormat = underlyingFormat;
          if (underlyingFormat) {
            return `hwdownload,format=cuda|${underlyingFormat.name}`;
          }
        }

        const hardwareFmt =
          this.currentState.pixelFormat.unwrap().toHardwareFormat() ??
          this.currentState.pixelFormat.unwrap();
        this.outputPixelFormat = hardwareFmt;
        if (hardwareFmt) {
          let format = hardwareFmt;
          if (format.isUnknown()) {
            switch (format.bitDepth) {
              case 8: {
                format = new PixelFormatYuv420P();
                break;
              }
              case 10: {
                format = new PixelFormatYuv420P10Le();
                break;
              }
              default:
                break;
            }
          }

          if (!format.isUnknown()) {
            return `hwdownload,format=${format.name}`;
          }
        }
      }
    }
    return hwdownload;
  }

  nextState(currentState: FrameState): FrameState {
    return currentState.update({
      frameDataLocation: FrameDataLocation.Software,
      pixelFormat: this.outputPixelFormat ?? currentState.pixelFormat,
    });
  }
}
