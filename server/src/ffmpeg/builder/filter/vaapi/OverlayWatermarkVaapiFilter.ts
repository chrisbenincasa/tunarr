import { OverlayWatermarkFilter } from '@/ffmpeg/builder/filter/watermark/OverlayWatermarkFilter.js';
import { PixelFormatUnknown } from '@/ffmpeg/builder/format/PixelFormat.js';
import type { FrameState } from '@/ffmpeg/builder/state/FrameState.js';
import type { FrameSize } from '@/ffmpeg/builder/types.js';
import { FrameDataLocation } from '@/ffmpeg/builder/types.js';
import type { Watermark } from '@tunarr/types';

export class OverlayWatermarkVaapiFilter extends OverlayWatermarkFilter {
  public affectsFrameState = true;

  constructor(watermark: Watermark, resolution: FrameSize) {
    super(watermark, resolution, resolution, PixelFormatUnknown());
  }

  nextState(currentState: FrameState): FrameState {
    return currentState.updateFrameLocation(FrameDataLocation.Hardware);
  }

  public get filter() {
    const durationOptions =
      this.watermark.duration > 0 ? ':eof_action=pass:repeatlast=0' : '';
    return `overlay_vaapi=${this.getPosition()}${durationOptions}`;
  }
}
