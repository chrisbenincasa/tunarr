import { GlobalOption } from './GlobalOption';

export class LogLevelOption extends GlobalOption {
  constructor(private level: string = 'error') {
    super();
  }

  globalOptions(): string[] {
    return ['-loglevel', this.level];
  }
}
