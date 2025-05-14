import type { HardwareAccelerationMode } from '@/db/schema/TranscodeConfig.js';
import { FrameDataLocation } from '../../types.ts';
import { NvidiaDecoder } from './NvidiaDecoder.ts';

export class NvidiaMpeg2Decoder extends NvidiaDecoder {
  readonly name = 'mpeg2_cuvid';

  constructor(
    hardwareAccelerationMode: HardwareAccelerationMode,
    private contentIsInterlaced: boolean,
  ) {
    super(hardwareAccelerationMode);
  }

  override get _outputFrameDataLocation() {
    return this.contentIsInterlaced
      ? FrameDataLocation.Software
      : super._outputFrameDataLocation;
  }
}
