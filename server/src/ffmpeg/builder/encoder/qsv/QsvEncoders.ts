import { once } from 'lodash-es';
import { VideoEncoder } from '../BaseEncoder';

abstract class QsvEncoder extends VideoEncoder {
  protected constructor(name: string) {
    super(name);
  }

  options(): string[] {
    return [...super.options(), '-low_power', '0', '-look_ahead', '0'];
  }
}

export class Mpeg2QsvEncoder extends QsvEncoder {
  private constructor() {
    super('mpeg2_qsv');
  }

  static create = once(() => new Mpeg2QsvEncoder());
}

export class H264QsvEncoder extends QsvEncoder {
  private constructor() {
    super('h264_qsv');
  }

  static create = once(() => new H264QsvEncoder());
}

export class HevcQsvEncoder extends QsvEncoder {
  private constructor() {
    super('hevc_qsv');
  }

  static create = once(() => new HevcQsvEncoder());
}
