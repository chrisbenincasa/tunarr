import { VideoFormats } from '@/ffmpeg/builder/constants.ts';
import { QsvEncoder } from './QsvEncoders.ts';

export class Mpeg2QsvEncoder extends QsvEncoder {
  protected videoFormat: string = VideoFormats.Mpeg2Video;

  constructor() {
    super('mpeg2_qsv');
  }
}
