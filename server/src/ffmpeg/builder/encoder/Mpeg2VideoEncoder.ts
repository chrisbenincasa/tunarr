import { VideoFormats } from '@/ffmpeg/builder/constants.js';
import { VideoEncoder } from './BaseEncoder.js';

export class Mpeg2VideoEncoder extends VideoEncoder {
  protected videoFormat = VideoFormats.Mpeg2Video;

  constructor() {
    super('mpeg2video');
  }
}
