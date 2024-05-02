import { FrameState } from '../../state/FrameState';
import { FrameSize } from '../../types';
import { FilterBase } from '../FilterBase';

export class ScaleCudaFilter extends FilterBase {
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
    return {
      ...currentState,
      scaledSize: this.scaledSize,
      paddedSize: this.scaledSize,
      frameDataLocation: 'hardware',
      // this filter always outputs square pixels
      isAnamorphic: false,
    };
  }

  private generateFilter(): string {
    let scale: string = '';

    if (this.currentState.scaledSize.equals(this.scaledSize) == false) {
      let aspectRatio = '';
      if (this.scaledSize.equals(this.paddedSize) == false) {
        aspectRatio = ':force_original_aspect_ratio=decrease';
      }

      let squareScale = '';
      const targetSize = `${this.paddedSize.width}:${this.paddedSize.height}`;
      if (this.currentState.isAnamorphic) {
        squareScale = `scale_cuda=iw*sar:ih,setsar=1,`;
      } else {
        aspectRatio += `,setsar=1`;
      }

      scale = `${squareScale}scale_cuda=${targetSize}${aspectRatio}`;
    }

    if (scale == '') {
      return scale;
    }

    return this.currentState.frameDataLocation == 'hardware'
      ? scale
      : `hwupload_cuda,${scale}`;
  }
}
