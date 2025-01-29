import type { FrameState } from '@/ffmpeg/builder/state/FrameState.js';
import { PixelFormatVaapi } from '../format/PixelFormat.ts';
import { FrameDataLocation } from '../types.ts';
import { FilterOption } from './FilterOption.ts';

export class HardwareDownloadFilter extends FilterOption {
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
          if (underlyingFormat) {
            return `hwdownload,format=vaapi|${underlyingFormat.name}`;
          }
        }

        const hardwareFmt =
          this.currentState.pixelFormat.unwrap().toHardwareFormat() ??
          this.currentState.pixelFormat.unwrap();
        if (hardwareFmt) {
          return `hwdownload,format=${hardwareFmt.name}`;
        }
      }
    }
    return hwdownload;
  }

  nextState(currentState: FrameState): FrameState {
    return currentState.update({
      frameDataLocation: FrameDataLocation.Software,
    });
  }
}
