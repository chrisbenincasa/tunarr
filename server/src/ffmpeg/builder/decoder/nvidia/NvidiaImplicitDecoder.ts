import { InputSource } from '@/ffmpeg/builder/input/InputSource.ts';
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
