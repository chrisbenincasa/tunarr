import { AudioEncoder } from '../BaseEncoder.ts';

export class PcmS16LeAudioEncoder extends AudioEncoder {
  constructor() {
    super('pcm_s16le');
  }
}
