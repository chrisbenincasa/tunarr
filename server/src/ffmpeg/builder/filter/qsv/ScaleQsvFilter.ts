import { isNonEmptyString } from '../../../../util';
import { VideoStream } from '../../MediaStream';
import { FrameState } from '../../state/FrameState';
import { FrameSize } from '../../types';
import { Filter } from '../FilterBase';

export class ScaleQsvFilter extends Filter {
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
    return {
      ...currentState,
      scaledSize: this.scaledSize,
      paddedSize: this.scaledSize,
      frameDataLocation: 'hardware',
      isAnamorphic: false,
    };
  }

  private generateFilter(): string {
    let scale = '';

    if (!this.currentState.scaledSize.equals(this.scaledSize)) {
      const targetSize = `w=${this.scaledSize.width}:h${this.scaledSize.height}`;
      const sarValue =
        this.videoStream.pixelAspectRatio?.replace(':', '/') ?? '1/1';
      let squareScale = '';
      let format = '';
      if (this.currentState.isAnamorphic) {
        squareScale = `vpp_qsv=w=iw*${sarValue}:h=ih,setsar=1`;
      } else {
        format = `,setsar=1`;
      }

      scale = `${squareScale}vpp_qsv=${targetSize}${format}`;
    }

    if (this.currentState.frameDataLocation === 'hardware') {
      return scale;
    }

    if (isNonEmptyString(scale)) {
      return `hwupload=extra_hw_frames=64,${scale}`;
    }

    return '';
  }
}
