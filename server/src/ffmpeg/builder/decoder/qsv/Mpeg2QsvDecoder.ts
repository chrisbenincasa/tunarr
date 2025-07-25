import type { BaseFfmpegHardwareCapabilities } from '../../capabilities/BaseFfmpegHardwareCapabilities.ts';
import { QsvDecoder } from './QsvDecoder.ts';

export class Mpeg2QsvDecoder extends QsvDecoder {
  constructor(hardwareCapabilities: BaseFfmpegHardwareCapabilities) {
    super('mpeg2_qsv', hardwareCapabilities);
  }
}
