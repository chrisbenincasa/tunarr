import { FilterOption } from '@/ffmpeg/builder/filter/FilterOption.js';
import {
  PixelFormatNv12,
  PixelFormatUnknown,
} from '@/ffmpeg/builder/format/PixelFormat.js';
import type { FrameState } from '@/ffmpeg/builder/state/FrameState.js';
import { FrameDataLocation } from '@/ffmpeg/builder/types.js';
import { ColorFormat } from '../../format/ColorFormat.ts';

export class TonemapOpenclFilter extends FilterOption {
  constructor(private currentState: FrameState) {
    super();
  }

  public get filter(): string {
    const tonemap =
      'hwmap=derive_device=opencl,tonemap_opencl=tonemap=hable:desat=0:t=bt709:m=bt709:p=bt709:format=nv12,hwmap=derive_device=vaapi:reverse=1';
    return this.currentState.frameDataLocation === FrameDataLocation.Hardware
      ? tonemap
      : `format=vaapi|nv12|p010le,${tonemap}`;
  }

  public readonly affectsFrameState: boolean = true;

  nextState(currentState: FrameState): FrameState {
    const currentPixelFormat =
      currentState.pixelFormat?.toSoftwareFormat() ?? currentState.pixelFormat;

    return currentState.update({
      colorFormat: ColorFormat.bt709,
      frameDataLocation: FrameDataLocation.Hardware,
      pixelFormat: new PixelFormatNv12(
        currentPixelFormat ?? PixelFormatUnknown(currentState.bitDepth),
      ),
    });
  }
}
