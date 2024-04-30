import { once } from 'lodash-es';
import { VideoEncoder } from '../BaseEncoder';
import { VideoFormats } from '../../constants';

export class NvidiaHevcEncoder extends VideoEncoder {
  protected videoFormat: string = VideoFormats.Hevc;

  private constructor() {
    super('hevc_nvenc');
  }

  options(): string[] {
    return [...super.options(), '-b_ref_mode', '0'];
  }

  static create = once(() => new NvidiaHevcEncoder());
}

export class NvidiaH264Encoder extends VideoEncoder {
  protected videoFormat: string = VideoFormats.H264;

  private constructor() {
    super('h264_nvenc');
  }

  static create = once(() => new NvidiaH264Encoder());
}
