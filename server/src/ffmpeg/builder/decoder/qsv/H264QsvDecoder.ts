import { PixelFormatNv12 } from '@/ffmpeg/builder/format/PixelFormat.js';
import { FrameState } from '@/ffmpeg/builder/state/FrameState.js';
import { QsvDecoder } from './QsvDecoder.ts';

export class H264QsvDecoder extends QsvDecoder {
  constructor() {
    super('h264_qsv');
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
