import { Option } from './Option';

export abstract class OutputOption extends Option {
  globalOptions(): string[] {
    return [];
  }

  filterOptions(): string[] {
    return [];
  }

  inputOptions(): string[] {
    return [];
  }
  // env vars
}

export abstract class ConstantOutputOption extends OutputOption {
  constructor(private options: [string, ...string[]]) {
    super();
  }

  outputOptions(): string[] {
    return this.options;
  }
}
