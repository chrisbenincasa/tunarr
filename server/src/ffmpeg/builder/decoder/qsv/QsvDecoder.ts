import { BaseDecoder } from '@/ffmpeg/builder/decoder/BaseDecoder.ts';
import { FrameDataLocation } from '@/ffmpeg/builder/types.ts';

export abstract class QsvDecoder extends BaseDecoder {
  affectsFrameState: boolean = true;

  protected outputFrameDataLocation: FrameDataLocation = 'hardware';

  protected constructor(public name: string) {
    super();
  }
}
