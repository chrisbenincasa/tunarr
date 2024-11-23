import { Duration } from 'dayjs/plugin/duration.js';
import { constant } from 'lodash-es';
import { InputOption } from './InputOption.ts';

export class StreamSeekInputOption extends InputOption {
  constructor(private start: Duration) {
    super();
  }

  appliesToInput = constant(true);

  options() {
    return ['-ss', `${this.start.asSeconds()}s`];
  }
}
