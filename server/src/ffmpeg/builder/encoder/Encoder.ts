import { OutputOption } from '@/ffmpeg/builder/options/OutputOption.js';
import type { StreamKind } from '@/ffmpeg/builder/types.js';

export abstract class Encoder extends OutputOption {
  name: string;
  kind: StreamKind;
  filter: string;
}
