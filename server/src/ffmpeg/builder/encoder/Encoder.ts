import { OutputOption } from '@/ffmpeg/builder/options/OutputOption.js';
import type { StreamKind } from '@/ffmpeg/builder/types.js';

export abstract class Encoder extends OutputOption {
  abstract name: string;
  abstract kind: StreamKind;
  abstract filter: string;
}
