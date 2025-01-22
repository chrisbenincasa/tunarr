import type { HardwareAccelerationMode } from '@/db/schema/TranscodeConfig.js';
import { NvidiaDecoder } from './NvidiaDecoders.ts';

export class NvidiaMpeg2Decoder extends NvidiaDecoder {
  readonly name = 'mpeg2_cuvid';

  constructor(
    hardwareAccelerationMode: HardwareAccelerationMode,
    contentIsInterlaced: boolean,
  ) {
    super(hardwareAccelerationMode);
    if (contentIsInterlaced) {
      this.outputFrameDataLocation = 'software';
    }
  }
}
