import { Watermark } from '@tunarr/types';
import { Filter } from '../FilterBase.js';
import { FrameSize } from '../../types.js';
import { PixelFormat } from '../../format/PixelFormat.js';
import { FrameState } from '../../state/FrameState.js';

export class OverlayWatermarkFilter extends Filter {
  public readonly affectsFrameState: boolean = true;
  public filter: string;

  constructor(
    private watermark: Watermark,
    private resolution: FrameSize,
    // private squarePixelResolution: FrameSize,
    private outputPixelFormat: PixelFormat,
  ) {
    super();
    this.filter = this.generateFilter();
  }

  nextState(currentState: FrameState): FrameState {
    return currentState.updateFrameLocation('software');
  }

  protected getPosition() {
    // We only support 'normal' margin mode currently.
    const x = Math.round(
      (this.watermark.horizontalMargin / 100.0) * this.resolution.width,
    );
    const y = Math.round(
      (this.watermark.verticalMargin / 100.0) * this.resolution.height,
    );

    let position: string;
    switch (this.watermark.position) {
      case 'top-left':
        position = `x=${x}:y=${y}`;
        break;
      case 'top-right':
        position = `x=W-w-${x}:y=${y}`;
        break;
      case 'bottom-left':
        position = `x=${x}:y=H-h-${y}`;
        break;
      case 'bottom-right':
        position = `x=W-w-${x}:y=H-h-${y}`;
        break;
    }

    return position;
  }

  private generateFilter() {
    return `overlay=${this.getPosition()}:format=${
      this.outputPixelFormat.bitDepth === 10 ? 1 : 0
    }`;
  }
}
