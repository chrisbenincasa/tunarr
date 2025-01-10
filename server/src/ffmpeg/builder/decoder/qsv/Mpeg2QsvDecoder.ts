import { QsvDecoder } from './QsvDecoder.ts';

export class Mpeg2QsvDecoder extends QsvDecoder {
  constructor() {
    super('mpeg2_qsv');
  }
}
