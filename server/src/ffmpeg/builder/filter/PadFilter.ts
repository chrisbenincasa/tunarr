import { PixelFormatVaapi } from '../format/PixelFormat.ts';
import { FrameState } from '../state/FrameState.ts';
import { FrameDataLocation, FrameSize } from '../types.ts';
import { FilterOption } from './FilterOption.ts';

export class PadFilter extends FilterOption {
  private currentFrameDataLocation: FrameDataLocation;
  private desiredPaddedSize: FrameSize;

  public readonly filter: string;
  public readonly affectsFrameState: boolean = true;

  constructor(
    private currentState: FrameState,
    desiredState: FrameState,
    // private hardwarePixelFormat: Nullable<PixelFormat> = null,
  ) {
    super();
    this.currentFrameDataLocation = currentState.frameDataLocation;
    this.desiredPaddedSize = desiredState.paddedSize;
    this.filter = this.generateFilter();
  }

  nextState(currentState: FrameState): FrameState {
    return currentState.update({
      paddedSize: this.desiredPaddedSize,
      frameDataLocation: 'software',
    });
  }

  private generateFilter(): string {
    const pad = `pad=${this.desiredPaddedSize.width}:${this.desiredPaddedSize.height}:-1:-1:color=black`;

    const currentPixelFormat = this.currentState.pixelFormat;
    if (this.currentFrameDataLocation === FrameDataLocation.Hardware) {
      if (currentPixelFormat) {
        if (currentPixelFormat instanceof PixelFormatVaapi) {
          const underlying = currentPixelFormat.unwrap();
          if (underlying) {
            return `hwdownload,format=vaapi|${underlying.ffmpegName},${pad}`;
          }
        }

        //  else if (currentPixelFormat.ffmpegName === FfmpegPixelFormats.NV12) {
        //   const underlying = currentPixelFormat.unwrap();
        //   if (underlying) {
        //     return `hwdownload,format=${underlying.ffmpegName},${pad}`;
        //   }
        // }

        return `hwdownload,format=${currentPixelFormat.ffmpegName},${pad}`;
      }

      return `hwdownload,${pad}`;
    }

    return pad;
  }
}
