import type { InputSource } from '@/ffmpeg/builder/input/InputSource.js';
import { SoftwareDecoder } from './SoftwareDecoder.ts';

export class ImplicitDecoder extends SoftwareDecoder {
  readonly name = '';
  options(_inputSource: InputSource): string[] {
    return [];
  }
}
