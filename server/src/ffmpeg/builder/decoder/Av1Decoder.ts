import { SoftwareDecoder } from '@/ffmpeg/builder/decoder/SoftwareDecoder.js';

export class Av1Decoder extends SoftwareDecoder {
  constructor(public name: 'libdav1d' | 'libaom-av1' | 'av1') {
    super();
  }
}
