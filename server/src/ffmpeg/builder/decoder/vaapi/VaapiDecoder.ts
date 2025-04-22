import { BaseDecoder } from '@/ffmpeg/builder/decoder/BaseDecoder.js';
import {
  PixelFormatNv12,
  PixelFormatVaapi,
} from '@/ffmpeg/builder/format/PixelFormat.js';
import type { FrameState } from '@/ffmpeg/builder/state/FrameState.js';
import { FrameDataLocation } from '../../types.ts';

export class VaapiDecoder extends BaseDecoder {
  readonly name: string = 'implicit_vaapi';

  protected _outputFrameDataLocation = FrameDataLocation.Hardware;

  options(): string[] {
    return ['-hwaccel_output_format', 'vaapi'];
  }

  nextState(currentState: FrameState): FrameState {
    const nextState = super.nextState(currentState);
    if (!currentState.pixelFormat) {
      return nextState;
    }

    return nextState.update({
      pixelFormat:
        currentState.pixelFormat.bitDepth === 8
          ? new PixelFormatNv12(currentState.pixelFormat)
          : new PixelFormatVaapi(currentState.pixelFormat),
    });
  }
}
