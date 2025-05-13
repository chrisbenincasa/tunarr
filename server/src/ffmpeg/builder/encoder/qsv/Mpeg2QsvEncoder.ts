import { VideoFormats } from '@/ffmpeg/builder/constants.js';
import { QsvEncoder } from './QsvEncoders.ts';

export class Mpeg2QsvEncoder extends QsvEncoder {
  protected videoFormat = VideoFormats.Mpeg2Video;

  constructor() {
    super('mpeg2_qsv');
  }
}
