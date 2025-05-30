import { VideoEncoder } from './BaseEncoder.js';

export class CopyVideoEncoder extends VideoEncoder {
  protected readonly videoFormat = '';

  constructor() {
    super('copy');
  }
}
