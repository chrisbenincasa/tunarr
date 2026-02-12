import type { FrameState } from '@/ffmpeg/builder/state/FrameState.js';
import { FrameDataLocation } from '@/ffmpeg/builder/types.js';
import { FilterOption } from '../FilterOption.ts';

/**
 * Hardware-accelerated tonemapping using VideoToolbox's tonemap_videotoolbox filter.
 * Converts HDR10 (PQ/BT.2020) content to SDR (BT.709).
 *
 * The VideoToolbox decoder outputs frames in software memory, so this filter
 * operates on software-side VT decoded frames. No hwdownload is needed.
 */
export class VideoToolboxTonemapFilter extends FilterOption {
  readonly filter: string;
  readonly affectsFrameState = true;

  constructor() {
    super();
    this.filter =
      'tonemap_videotoolbox=color_primaries=bt709:transfer_characteristics=bt709:color_matrix=bt709';
  }

  nextState(currentState: FrameState): FrameState {
    return currentState.update({
      frameDataLocation: FrameDataLocation.Software,
    });
  }
}
