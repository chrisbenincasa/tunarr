import { BaseDecoder } from '@/ffmpeg/builder/decoder/BaseDecoder.js';
import type { MediaStream } from '../../MediaStream.ts';
import type { InputSource } from '../../input/InputSource.ts';

export class VideoToolboxDecoder extends BaseDecoder {
  readonly name: string = '';

  options(_inputSource: InputSource<MediaStream>): string[] {
    return [];
  }

  protected _outputFrameDataLocation: 'unknown' | 'hardware' | 'software' =
    'software';
}
