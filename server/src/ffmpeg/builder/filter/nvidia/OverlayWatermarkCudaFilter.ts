import { Watermark } from '@tunarr/types';
import { PixelFormatUnknown } from '../../format/PixelFormat.ts';
import { FrameState } from '../../state/FrameState.ts';
import { FrameSize } from '../../types.ts';
import { OverlayWatermarkFilter } from '../watermark/OverlayWatermarkFilter.ts';

export class OverlayWatermarkCudaFilter extends OverlayWatermarkFilter {
  public affectsFrameState: boolean = true;

  constructor(watermark: Watermark, resolution: FrameSize) {
    super(watermark, resolution, resolution, PixelFormatUnknown());
    this.filter = `overlay_cuda=${this.getPosition()}`;
  }

  nextState(currentState: FrameState): FrameState {
    return currentState.updateFrameLocation('hardware');
  }
}
