import { OutputOption } from '../options/OutputOption.ts';
import { StreamKind } from '../types.ts';

export abstract class Encoder extends OutputOption {
  name: string;
  kind: StreamKind;
  filter: string;
}
