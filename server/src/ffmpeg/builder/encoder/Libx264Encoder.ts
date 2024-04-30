import { VideoEncoder } from './BaseEncoder';

export class Libx264Encoder extends VideoEncoder {
  constructor() {
    super('libx264');
  }
}
