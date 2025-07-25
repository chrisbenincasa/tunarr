import type { BaseFfmpegHardwareCapabilities } from '../../capabilities/BaseFfmpegHardwareCapabilities.ts';
import { QsvDecoder } from './QsvDecoder.ts';

export class Vc1QsvDecoder extends QsvDecoder {
  constructor(hardwareCapabilities: BaseFfmpegHardwareCapabilities) {
    super('vc1_qsv', hardwareCapabilities);
  }
}
