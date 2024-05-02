import {
  FrameDataLocation,
  HardwareAccelerationMode,
  InputFile,
} from '../../types';
import { BaseDecoder } from '../BaseDecoder';

export abstract class NvidiaDecoder extends BaseDecoder {
  protected outputFrameDataLocation: FrameDataLocation;

  constructor(private hardwareAccelerationMode: HardwareAccelerationMode) {
    super();
    this.outputFrameDataLocation =
      hardwareAccelerationMode === 'none' ? 'software' : 'hardware';
  }

  inputOptions(inputFile: InputFile): string[] {
    const result = super.inputOptions(inputFile);
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
