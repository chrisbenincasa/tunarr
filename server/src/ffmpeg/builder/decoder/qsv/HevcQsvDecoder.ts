import {
  PixelFormatNv12,
  PixelFormatP010,
} from '@/ffmpeg/builder/format/PixelFormat.js';
import { FrameState } from '@/ffmpeg/builder/state/FrameState.js';
import { QsvDecoder } from './QsvDecoder.ts';

export class HevcQsvDecoder extends QsvDecoder {
  constructor() {
    super('hevc_qsv');
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
