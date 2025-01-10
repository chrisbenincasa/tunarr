import {
  PixelFormatNv12,
  PixelFormatP010,
} from '@/ffmpeg/builder/format/PixelFormat.ts';
import { FrameState } from '@/ffmpeg/builder/state/FrameState.ts';
import { QsvDecoder } from './QsvDecoder.ts';

export class Vp9QsvDecoder extends QsvDecoder {
  constructor() {
    super('vp9_qsv');
  }

  nextState(currentState: FrameState): FrameState {
    const next = super.nextState(currentState);

    if (currentState.pixelFormat) {
      if (currentState.pixelFormat.bitDepth === 10) {
        return next.update({ pixelFormat: new PixelFormatP010() });
      }
      return next.update({
        pixelFormat: new PixelFormatNv12(currentState.pixelFormat),
      });
    }

    return next;
  }
}
