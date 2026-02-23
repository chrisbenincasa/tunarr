import { OutputOption } from './OutputOption.ts';

export class NullOutputFormat extends OutputOption {
  options(): string[] {
    return ['-f', 'null'];
  }
}
