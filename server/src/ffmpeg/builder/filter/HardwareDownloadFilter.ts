import { FrameState } from '@/ffmpeg/builder/state/FrameState.ts';
import { isNonEmptyString } from '@/util/index.ts';
import {
  FfmpegPixelFormats,
  KnownPixelFormats,
} from '../format/PixelFormat.ts';
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

  nextState(currentState: FrameState): FrameState {
    return currentState.update({
      frameDataLocation: FrameDataLocation.Software,
    });
  }
}
