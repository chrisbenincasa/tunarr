import { OverlayWatermarkFilter } from '@/ffmpeg/builder/filter/watermark/OverlayWatermarkFilter.js';
import { PixelFormatUnknown } from '@/ffmpeg/builder/format/PixelFormat.js';
import { FrameState } from '@/ffmpeg/builder/state/FrameState.js';
import { FrameDataLocation, FrameSize } from '@/ffmpeg/builder/types.js';
import { Watermark } from '@tunarr/types';

export class OverlayWatermarkCudaFilter extends OverlayWatermarkFilter {
  public affectsFrameState: boolean = true;

  constructor(watermark: Watermark, resolution: FrameSize) {
    super(watermark, resolution, resolution, PixelFormatUnknown());
    this.filter = `overlay_cuda=${this.getPosition()}`;
  }

  nextState(currentState: FrameState): FrameState {
    return currentState.updateFrameLocation(FrameDataLocation.Hardware);
  }
}
