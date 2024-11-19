import { BaseDecoder } from '@/ffmpeg/builder/decoder/BaseDecoder.ts';
import { FrameDataLocation } from '@/ffmpeg/builder/types.ts';

abstract class QsvDecoder extends BaseDecoder {
  protected outputFrameDataLocation: FrameDataLocation = 'hardware';

  protected constructor(public name: string) {
    super();
  }
}

export class H264QsvDecoder extends QsvDecoder {
  constructor() {
    super('h264_qsv');
  }
}

export class Mpeg2QsvDecoder extends QsvDecoder {
  constructor() {
    super('mpeg2_qsv');
  }
}

export class HevcQsvDecoder extends QsvDecoder {
  constructor() {
    super('hevc_qsv');
  }
}

export class Vc1QsvDecoder extends QsvDecoder {
  constructor() {
    super('vc1_qsv');
  }
}

export class Vp9QsvDecoder extends QsvDecoder {
  constructor() {
    super('vp9_qsv');
  }
}
