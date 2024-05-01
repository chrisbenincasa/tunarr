import { constant } from 'lodash-es';
import { FrameDataLocation } from '../types';
import { BaseDecoder } from './BaseDecoder';

abstract class SoftwareDecoder extends BaseDecoder {
  protected outputFrameDataLocation: FrameDataLocation = 'software';
}

export class ImplicitDecoder extends SoftwareDecoder {
  name = '';
  inputOptions = constant([]);
}

export class H264Decoder extends SoftwareDecoder {
  name = 'h264';
}
