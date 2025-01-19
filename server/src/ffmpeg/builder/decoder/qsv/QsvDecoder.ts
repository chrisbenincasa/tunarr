import { BaseDecoder } from '@/ffmpeg/builder/decoder/BaseDecoder.js';
import { FrameDataLocation } from '@/ffmpeg/builder/types.js';

export abstract class QsvDecoder extends BaseDecoder {
  affectsFrameState: boolean = true;

  protected outputFrameDataLocation: FrameDataLocation = 'hardware';

  protected constructor(public name: string) {
    super();
  }
}
