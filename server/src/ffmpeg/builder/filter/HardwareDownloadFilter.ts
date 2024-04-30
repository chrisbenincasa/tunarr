import { isNonEmptyString } from '../../../util/index.ts';
import {
  FfmpegPixelFormats,
  KnownPixelFormats,
} from '../format/PixelFormat.ts';
import { FrameState } from '../state/FrameState.ts';
import { FilterOption } from './FilterOption.ts';

export class HardwareDownloadFilter extends FilterOption {
  constructor(private currentState: FrameState) {
    super();
  }

  get filter() {
    let hwdownload = '';
    if (this.currentState.frameDataLocation === 'hardware') {
      hwdownload = 'hwdownload';
      if (this.currentState.pixelFormat) {
        if (
          this.currentState.pixelFormat.ffmpegName === FfmpegPixelFormats.VAAPI
        ) {
          const softwarePixelFormat = KnownPixelFormats.forPixelFormat(
            this.currentState.pixelFormat.name,
          );
          if (softwarePixelFormat) {
            return `hwdownload,format=vaapi|${softwarePixelFormat.ffmpegName}`;
          }
        }

        if (isNonEmptyString(this.currentState.pixelFormat.ffmpegName)) {
          return `hwdownload,format=${this.currentState.pixelFormat.ffmpegName}`;
        }
      }
    }
    return hwdownload;
  }
}
