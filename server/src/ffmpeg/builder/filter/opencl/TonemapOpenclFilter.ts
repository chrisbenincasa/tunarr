import { FilterOption } from '@/ffmpeg/builder/filter/FilterOption.js';
import {
  PixelFormatNv12,
  PixelFormatUnknown,
  PixelFormatYuv420P,
} from '@/ffmpeg/builder/format/PixelFormat.js';
import { DefaultTonemapPeakNits } from '@/ffmpeg/builder/options/KnownFfmpegOptions.js';
import type { FrameState } from '@/ffmpeg/builder/state/FrameState.js';
import { FrameDataLocation } from '@/ffmpeg/builder/types.js';
import { ColorFormat } from '../../format/ColorFormat.ts';

export class TonemapOpenclFilter extends FilterOption {
  constructor(private currentState: FrameState) {
    super();
  }

  public get filter(): string {
    // format=vaapi pins the reverse map's output to VAAPI frames. Without it,
    // a following filter that accepts any hardware format (e.g. hwdownload)
    // lets the output stay 'opencl', which VAAPI rejects.
    const tonemap = `hwmap=derive_device=opencl,tonemap_opencl=tonemap=hable:desat=0:peak=${DefaultTonemapPeakNits}:t=bt709:m=bt709:p=bt709:format=nv12,hwmap=derive_device=vaapi:reverse=1,format=vaapi`;
    return this.currentState.frameDataLocation === FrameDataLocation.Hardware
      ? tonemap
      : `format=vaapi|nv12|p010le,${tonemap}`;
  }

  public readonly affectsFrameState: boolean = true;

  nextState(currentState: FrameState): FrameState {
    const currentPixelFormat =
      currentState.pixelFormat?.toSoftwareFormat() ?? currentState.pixelFormat;

    // tonemap_opencl always outputs 8-bit nv12, whatever the source bit depth
    let outputPixelFormat = currentPixelFormat ?? PixelFormatUnknown(8);
    if (outputPixelFormat.bitDepth !== 8) {
      outputPixelFormat = new PixelFormatYuv420P();
    }

    return currentState.update({
      colorFormat: ColorFormat.bt709,
      frameDataLocation: FrameDataLocation.Hardware,
      pixelFormat: new PixelFormatNv12(outputPixelFormat),
    });
  }
}
