import { InputSource } from '@/ffmpeg/builder/input/InputSource.ts';
import { FrameDataLocation } from '@/ffmpeg/builder/types.ts';
import { BaseDecoder } from './BaseDecoder.ts';

abstract class SoftwareDecoder extends BaseDecoder {
  protected outputFrameDataLocation: FrameDataLocation =
    FrameDataLocation.Software;
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

export class HevcDecoder extends SoftwareDecoder {
  readonly name: string = 'hevc';
}

export class Mpeg2Decoder extends SoftwareDecoder {
  readonly name: string = 'mpeg2video';
}

export class Vc1Decoder extends SoftwareDecoder {
  readonly name: string = 'vc1';
}

export class Mpeg4Decoder extends SoftwareDecoder {
  readonly name: string = 'mpeg4';
}

export class RawVideoDecoder extends SoftwareDecoder {
  readonly name: string = 'rawvideo';
}
