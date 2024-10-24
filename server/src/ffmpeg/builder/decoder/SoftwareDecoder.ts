import { FrameDataLocation, InputSource } from '../types';
import { BaseDecoder } from './BaseDecoder';

abstract class SoftwareDecoder extends BaseDecoder {
  protected outputFrameDataLocation: FrameDataLocation = 'software';
}

export class ImplicitDecoder extends SoftwareDecoder {
  readonly name = '';
  options(_inputSource: InputSource): string[] {
    return [];
  }
}

export class H264Decoder extends SoftwareDecoder {
  readonly name = 'h264';
}
