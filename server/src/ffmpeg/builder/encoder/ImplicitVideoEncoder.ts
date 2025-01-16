import { VideoEncoder } from './BaseEncoder.js';

export class ImplicitVideoEncoder extends VideoEncoder {
  protected readonly videoFormat: string = '';

  constructor() {
    super('');
  }

  options(): string[] {
    return [];
  }
}
