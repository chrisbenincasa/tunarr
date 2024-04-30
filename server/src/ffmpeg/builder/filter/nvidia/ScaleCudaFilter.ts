import { isEmpty, isNil } from 'lodash-es';
import { FrameState } from '../../state/FrameState.ts';
import { FrameDataLocation, FrameSize } from '../../types.ts';
import { FilterOption } from '../FilterOption.ts';

export class ScaleCudaFilter extends FilterOption {
  readonly filter: string;
  readonly affectsFrameState: boolean = true;

  constructor(
    private currentState: FrameState,
    private scaledSize: FrameSize,
    private paddedSize: FrameSize,
  ) {
    super();
    this.filter = this.generateFilter();
  }

  nextState(currentState: FrameState): FrameState {
    return currentState.update({
      scaledSize: this.scaledSize,
      paddedSize: this.scaledSize,
      frameDataLocation: FrameDataLocation.Hardware,
      // this filter always outputs square pixels
      isAnamorphic: false,
    });
  }

  private generateFilter(): string {
    let scale: string = '';

    if (this.currentState.scaledSize.equals(this.scaledSize)) {
      if (!isNil(this.currentState.pixelFormat)) {
        scale = `scale_cuda=format=${this.currentState.pixelFormat.ffmpegName}`;
      }
    } else {
      let aspectRatio = '';
      if (!this.scaledSize.equals(this.paddedSize)) {
        aspectRatio = ':force_original_aspect_ratio=decrease';
      }

      let squareScale = '';
      const targetSize = `${this.paddedSize.width}:${this.paddedSize.height}`;
      let format = '';
      if (!isNil(this.currentState.pixelFormat)) {
        format = `:format=${this.currentState.pixelFormat.ffmpegName}`;
      }

      if (this.currentState.isAnamorphic) {
        squareScale = `scale_cuda=iw*sar:ih,setsar=1,`;
      } else {
        aspectRatio += `,setsar=1`;
      }

      scale = `${squareScale}scale_cuda=${targetSize}${format}${aspectRatio}`;
    }

    if (isEmpty(scale)) {
      return scale;
    }

    return this.currentState.frameDataLocation === FrameDataLocation.Hardware
      ? scale
      : `hwupload_cuda,${scale}`;
  }
}
