import { VideoEncoder } from './BaseEncoder.js';

export class CopyVideoEncoder extends VideoEncoder {
  protected readonly videoFormat: string = '';

  constructor() {
    super('copy');
  }
}
