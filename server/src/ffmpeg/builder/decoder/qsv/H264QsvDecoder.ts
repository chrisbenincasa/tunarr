import { PixelFormatNv12 } from '@/ffmpeg/builder/format/PixelFormat.js';
import type { FrameState } from '@/ffmpeg/builder/state/FrameState.js';
import { type BaseFfmpegHardwareCapabilities } from '../../capabilities/BaseFfmpegHardwareCapabilities.ts';
import { QsvDecoder } from './QsvDecoder.ts';

export class H264QsvDecoder extends QsvDecoder {
  constructor(hardwareCapabilities: BaseFfmpegHardwareCapabilities) {
    super('h264_qsv', hardwareCapabilities);
  }

  nextState(currentState: FrameState): FrameState {
    const next = super.nextState(currentState);

    if (currentState.pixelFormat) {
      return next.update({
        pixelFormat: new PixelFormatNv12(currentState.pixelFormat),
      });
    }

    return next;
  }
}
