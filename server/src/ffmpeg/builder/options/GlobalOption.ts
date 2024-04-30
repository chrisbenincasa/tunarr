import { isString } from 'lodash-es';
import { Option } from './Option.js';

export abstract class GlobalOption extends Option {
  // env vars...
  inputOptions(): string[] {
    return [];
  }

  filterOptions(): string[] {
    return [];
  }

  outputOptions(): string[] {
    return [];
  }
}

export abstract class ConstantGlobalOption extends GlobalOption {
  private options: [string, ...string[]];

  constructor(options: string);
  constructor(options: [string, ...string[]]);
  constructor(options: string | [string, ...string[]]) {
    super();
    this.options = isString(options) ? [options] : options;
  }

  globalOptions(): string[] {
    return this.options;
  }
}

// Test out if all of these concrete classes are necessary

export class HideBannerOption extends ConstantGlobalOption {
  constructor() {
    super(['-hide_banner']);
  }
}

export class ThreadCountOption extends ConstantGlobalOption {
  constructor(threadCount: number) {
    super(['-threads', threadCount.toString(10)]);
  }
}

export class NoStdInOption extends ConstantGlobalOption {
  constructor() {
    super('-nostdin');
  }
}
