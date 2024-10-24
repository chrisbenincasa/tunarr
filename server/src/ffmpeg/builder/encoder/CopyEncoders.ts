import { once } from 'lodash-es';
import { AudioEncoder, VideoEncoder } from './BaseEncoder';

export class CopyVideoEncoder extends VideoEncoder {
  protected videoFormat: string;
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
