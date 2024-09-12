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
  readonly name = 'h264_cuvid';
}

export class NvidiaHevcDecoder extends NvidiaDecoder {
  readonly name = 'hevc_cuvid';
}

export class NvidiaVc1Decoder extends NvidiaDecoder {
  readonly name = 'vc1_cuvid';
}

export class NvidiaVp9Decoder extends NvidiaDecoder {
  readonly name = 'vp9_cuvid';
}

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

export class NvidiaImplicitDecoder extends NvidiaDecoder {
  constructor() {
    super('cuda');
  }

  readonly name = '';

  options(_inputFile: InputSource): string[] {
    return ['-hwaccel_output_format', 'cuda'];
  }
}
