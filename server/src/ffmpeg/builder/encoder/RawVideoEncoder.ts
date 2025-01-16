import { VideoFormats } from '@/ffmpeg/builder/constants.js';
import { VideoEncoder } from './BaseEncoder.js';

export class RawVideoEncoder extends VideoEncoder {
  protected videoFormat: string = VideoFormats.Raw;

  constructor() {
    super('rawvideo');
  }
}
