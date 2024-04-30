import { once } from 'lodash-es';
import { VideoEncoder, AudioEncoder } from './BaseEncoder';

export class CopyVideoEncoder extends VideoEncoder {
  private constructor() {
    super('copy');
  }

  static create = once(() => new CopyVideoEncoder());
}

export class CopyAudioEncoder extends AudioEncoder {
  constructor() {
    super('copy');
  }
}
