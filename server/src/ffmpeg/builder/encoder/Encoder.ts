import { OutputOption } from '@/ffmpeg/builder/options/OutputOption.ts';
import { StreamKind } from '@/ffmpeg/builder/types.ts';

export abstract class Encoder extends OutputOption {
  name: string;
  kind: StreamKind;
  filter: string;
}
