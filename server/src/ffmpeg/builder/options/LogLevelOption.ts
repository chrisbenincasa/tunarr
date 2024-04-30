import { ConstantGlobalOption } from './GlobalOption';

export class LogLevelOption extends ConstantGlobalOption {
  constructor(level: string = 'error') {
    super(['-loglevel', level]);
  }
}
