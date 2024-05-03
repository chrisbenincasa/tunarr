import {
  FrameDataLocation,
  HardwareAccelerationMode,
  InputSource,
} from '../../types';
import { BaseDecoder } from '../BaseDecoder';

export abstract class NvidiaDecoder extends BaseDecoder {
  protected outputFrameDataLocation: FrameDataLocation;

  constructor(private hardwareAccelerationMode: HardwareAccelerationMode) {
    super();
    this.outputFrameDataLocation =
      hardwareAccelerationMode === 'none' ? 'software' : 'hardware';
  }

  options(inputFile: InputSource): string[] {
    const result = super.options(inputFile);
    if (this.hardwareAccelerationMode !== 'none') {
      result.push('-hwaccel_output_format', 'cuda');
    } else {
      result.push(super.inputBitDepth(inputFile) === 10 ? 'p0101e' : 'nv12');
    }

    return result;
  }
}

export class NvidiaH264Decoder extends NvidiaDecoder {
  constructor(hardwareAccelerationMode: HardwareAccelerationMode) {
    super(hardwareAccelerationMode);
  }

  name = 'h264_cuvid';
}
