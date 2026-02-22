import { ColorFormat } from '../format/ColorFormat.ts';
import type { PixelFormat } from '../format/PixelFormat.ts';
import type { FrameState } from '../state/FrameState.ts';
import { FrameDataLocation } from '../types.ts';
import { FilterOption } from './FilterOption.ts';

export class LibplaceboTonemapFilter extends FilterOption {
  public readonly affectsFrameState: boolean = true;
  private targetPixelFormat: PixelFormat;

  constructor(targetPixelFormat: PixelFormat) {
    super();
    this.targetPixelFormat =
      targetPixelFormat.toHardwareFormat() ?? targetPixelFormat;
  }

  public get filter(): string {
    // TODO: Allow setting tonemapping algo
    return `libplacebo=tonemapping=auto:colorspace=bt709:color_primaries=bt709:color_trc=bt709:format=${this.targetPixelFormat.name},hwupload_cuda`;
  }

  nextState(currentState: FrameState): FrameState {
    return currentState.update({
      pixelFormat: this.targetPixelFormat,
      frameDataLocation: FrameDataLocation.Hardware,
      colorFormat: ColorFormat.bt709,
    });
  }
}
