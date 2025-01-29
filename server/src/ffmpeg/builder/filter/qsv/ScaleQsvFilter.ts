import { FilterOption } from '@/ffmpeg/builder/filter/FilterOption.js';
import { PixelFormats } from '@/ffmpeg/builder/format/PixelFormat.js';
import type { VideoStream } from '@/ffmpeg/builder/MediaStream.js';
import type { FrameState } from '@/ffmpeg/builder/state/FrameState.js';
import type { FrameSize } from '@/ffmpeg/builder/types.js';
import { FrameDataLocation } from '@/ffmpeg/builder/types.js';
import { isNonEmptyString } from '@/util/index.js';

export class ScaleQsvFilter extends FilterOption {
  readonly filter: string;
  readonly affectsFrameState: boolean = true;

  constructor(
    private videoStream: VideoStream,
    private currentState: FrameState,
    private scaledSize: FrameSize,
  ) {
    super();
    this.filter = this.generateFilter();
  }

  nextState(currentState: FrameState): FrameState {
    let nextState = currentState.update({
      scaledSize: this.scaledSize,
      paddedSize: this.scaledSize,
      frameDataLocation: FrameDataLocation.Hardware,
      isAnamorphic: false,
    });

    if (
      !this.currentState.pixelFormat &&
      this.currentState.frameDataLocation === FrameDataLocation.Software &&
      (currentState.pixelFormat
        ? currentState.pixelFormat.name !== PixelFormats.NV12
        : false)
    ) {
      nextState = nextState.update({
        pixelFormat: currentState.pixelFormat?.toHardwareFormat(),
      });
    } else if (this.currentState.pixelFormat) {
      nextState = nextState.update({
        pixelFormat: this.currentState.pixelFormat,
      });
    }

    return nextState;
  }

  private generateFilter(): string {
    let scale = '';

    if (!this.currentState.scaledSize.equals(this.scaledSize)) {
      const targetSize = `w=${this.scaledSize.width}:h=${this.scaledSize.height}`;
      const sarValue =
        this.videoStream.sampleAspectRatio?.replace(':', '/') ?? '1/1';
      let squareScale = '';
      let format = '';
      if (this.currentState.isAnamorphic) {
        squareScale = `vpp_qsv=w=iw*${sarValue}:h=ih,setsar=1,`;
      } else {
        format = `,setsar=1`;
      }

      scale = `${squareScale}vpp_qsv=${targetSize}${format}`;
    }

    if (this.currentState.frameDataLocation === FrameDataLocation.Hardware) {
      return scale;
    }

    const fmt =
      this.currentState.pixelFormat?.toHardwareFormat()?.name ??
      PixelFormats.NV12;
    if (isNonEmptyString(scale)) {
      return `format=${fmt},hwupload=extra_hw_frames=64,${scale}`;
    }

    return '';
  }
}
