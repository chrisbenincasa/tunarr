import type { VideoFormat } from '../constants.ts';
import { AudioEncoder, BaseEncoder, VideoEncoder } from './BaseEncoder.ts';

export class CopyVideoEncoder extends VideoEncoder {
  protected videoFormat: VideoFormat;

  constructor() {
    super('copy');
  }
}

export class CopyAudioEncoder extends AudioEncoder {
  constructor() {
    super('copy');
  }
}

export class CopyAllEncoder extends BaseEncoder {
  constructor() {
    super('copy', 'all');
  }

  options(): string[] {
    return ['-c', 'copy'];
  }
}
