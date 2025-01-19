import { BaseDecoder } from '@/ffmpeg/builder/decoder/BaseDecoder.js';
import { MediaStream } from '../../MediaStream.ts';
import { InputSource } from '../../input/InputSource.ts';

export class VideoToolboxDecoder extends BaseDecoder {
  readonly name: string = '';

  options(_inputSource: InputSource<MediaStream>): string[] {
    return [];
  }

  protected outputFrameDataLocation: 'unknown' | 'hardware' | 'software' =
    'software';
}
