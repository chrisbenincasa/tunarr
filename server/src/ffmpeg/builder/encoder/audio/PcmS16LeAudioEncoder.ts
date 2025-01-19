import { AudioEncoder } from '@/ffmpeg/builder/encoder/BaseEncoder.js';

export class PcmS16LeAudioEncoder extends AudioEncoder {
  constructor() {
    super('pcm_s16le');
  }
}
