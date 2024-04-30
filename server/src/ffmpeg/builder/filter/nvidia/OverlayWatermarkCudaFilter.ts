import { Watermark } from '@tunarr/types';
import { FrameState } from '../../state/FrameState';
import { OverlayWatermarkFilter } from '../watermark/OverlayWatermarkFilter';
import { FrameSize } from '../../types';
import { PixelFormatUnknown } from '../../format/PixelFormat';

export class OverlayWatermarkCudaFilter extends OverlayWatermarkFilter {
  public affectsFrameState: boolean = true;

  constructor(watermark: Watermark, resolution: FrameSize) {
    super(watermark, resolution, PixelFormatUnknown());
    this.filter = `overlay_cuda=${this.getPosition()}`;
  }

  nextState(currentState: FrameState): FrameState {
    return currentState.updateFrameLocation('hardware');
  }
}
