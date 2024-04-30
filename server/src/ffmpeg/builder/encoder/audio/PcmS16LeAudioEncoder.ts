import { AudioEncoder } from '../BaseEncoder';

export class PcmS16LeAudioEncoder extends AudioEncoder {
  constructor() {
    super('pcm_s16le');
  }
}
