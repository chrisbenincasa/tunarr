import {
  PixelFormatNv12,
  PixelFormatP010,
} from '@/ffmpeg/builder/format/PixelFormat.js';
import type { FrameState } from '@/ffmpeg/builder/state/FrameState.js';
import { type BaseFfmpegHardwareCapabilities } from '../../capabilities/BaseFfmpegHardwareCapabilities.ts';
import { QsvDecoder } from './QsvDecoder.ts';

export class Av1QsvDecoder extends QsvDecoder {
  constructor(hardwareCapabilities: BaseFfmpegHardwareCapabilities) {
    super('av1_qsv', hardwareCapabilities);
  }

  nextState(currentState: FrameState): FrameState {
    const next = super.nextState(currentState);

    if (currentState.pixelFormat) {
      if (currentState.pixelFormat.bitDepth === 10) {
        return next.update({
          pixelFormat: new PixelFormatP010(),
        });
      }

      return next.update({
        pixelFormat: new PixelFormatNv12(currentState.pixelFormat),
      });
    }

    return next;
  }
}
