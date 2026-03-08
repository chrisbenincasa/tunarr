import { FilterOption } from '@/ffmpeg/builder/filter/FilterOption.js';
import { PixelFormatYuv420P } from '@/ffmpeg/builder/format/PixelFormat.js';
import type { FrameState } from '@/ffmpeg/builder/state/FrameState.js';
import { FrameDataLocation } from '@/ffmpeg/builder/types.js';
import { ColorFormat } from '../format/ColorFormat.ts';

export class TonemapFilter extends FilterOption {
  constructor(private currentState: FrameState) {
    super();
  }

  public readonly affectsFrameState = true;

  public get filter(): string {
    const tonemap =
      'zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=s=bt709:t=bt709:m=bt709:r=tv,format=yuv420p';
    return this.currentState.frameDataLocation === FrameDataLocation.Hardware
      ? `hwdownload,format=p010le|nv12,${tonemap}`
      : tonemap;
  }

  nextState(currentState: FrameState): FrameState {
    return currentState.update({
      colorFormat: ColorFormat.bt709,
      frameDataLocation: FrameDataLocation.Software,
      pixelFormat: new PixelFormatYuv420P(),
    });
  }
}
