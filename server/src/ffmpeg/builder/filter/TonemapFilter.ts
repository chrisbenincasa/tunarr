import type { FrameState } from '@/ffmpeg/builder/state/FrameState.js';
import { FrameDataLocation } from '@/ffmpeg/builder/types.js';
import { PixelFormatYuv420P } from '../format/PixelFormat.ts';
import { FilterOption } from './FilterOption.ts';

/**
 * Software tonemapping filter chain using zscale + tonemap.
 * Converts HDR10 (PQ/BT.2020) content to SDR (BT.709).
 *
 * Filter chain:
 *   zscale=t=linear:npl=100  - Convert PQ transfer to linear light
 *   format=gbrpf32le          - Use float precision for tonemap math
 *   zscale=p=bt709            - Convert BT.2020 primaries to BT.709
 *   tonemap=hable:desat=0     - Apply Hable tonemap operator
 *   zscale=t=bt709:m=bt709:r=tv - Convert to BT.709 transfer/matrix
 *   format=yuv420p            - Convert back to standard pixel format
 */
export class TonemapFilter extends FilterOption {
  readonly filter: string;
  readonly affectsFrameState = true;

  constructor() {
    super();
    this.filter = [
      'zscale=t=linear:npl=100',
      'format=gbrpf32le',
      'zscale=p=bt709',
      'tonemap=hable:desat=0',
      'zscale=t=bt709:m=bt709:r=tv',
      'format=yuv420p',
    ].join(',');
  }

  nextState(currentState: FrameState): FrameState {
    return currentState.update({
      pixelFormat: new PixelFormatYuv420P(),
      frameDataLocation: FrameDataLocation.Software,
    });
  }
}
