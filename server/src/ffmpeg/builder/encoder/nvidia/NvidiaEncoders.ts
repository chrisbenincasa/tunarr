import { once } from 'lodash-es';
import { VideoEncoder } from '../BaseEncoder';

export class NvidiaHevcEncoder extends VideoEncoder {
  private constructor() {
    super('hevc_nvenc');
  }

  options(): string[] {
    return [...super.options(), '-b_ref_mode', '0'];
  }

  static create = once(() => new NvidiaHevcEncoder());
}

export class NvidiaH264Encoder extends VideoEncoder {
  private constructor() {
    super('h264_nvenc');
  }

  static create = once(() => new NvidiaH264Encoder());
}
