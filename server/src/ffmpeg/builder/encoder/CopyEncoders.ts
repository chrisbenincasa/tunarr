import { VideoEncoder, AudioEncoder } from './BaseEncoder';

export class CopyVideoEncoder extends VideoEncoder {
  constructor() {
    super('copy');
  }
}

export class CopyAudioEncoder extends AudioEncoder {
  constructor() {
    super('copy');
  }
}
