import { constant, isString } from 'lodash-es';
import { InputOption } from './InputOption.ts';

export class StreamSeekInputOption extends InputOption {
  constructor(private start: string | number) {
    super();
  }

  appliesToInput = constant(true);

  options() {
    return ['-ss', isString(this.start) ? this.start : `${this.start}s`];
  }
}
