import { InputSource } from '@/ffmpeg/builder/input/InputSource.ts';
import { SoftwareDecoder } from './SoftwareDecoder.ts';

export class ImplicitDecoder extends SoftwareDecoder {
  readonly name = '';
  options(_inputSource: InputSource): string[] {
    return [];
  }
}
