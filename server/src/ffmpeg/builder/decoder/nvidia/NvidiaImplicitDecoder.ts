import type { InputSource } from '@/ffmpeg/builder/input/InputSource.js';
import { NvidiaDecoder } from './NvidiaDecoders.ts';

export class NvidiaImplicitDecoder extends NvidiaDecoder {
  constructor() {
    super('cuda');
  }

  readonly name = '';

  options(_inputFile: InputSource): string[] {
    return ['-hwaccel_output_format', 'cuda'];
  }
}
