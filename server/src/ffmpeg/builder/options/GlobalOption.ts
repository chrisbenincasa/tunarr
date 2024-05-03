import { identity, isString } from 'lodash-es';
import { Option } from './Option.js';

export abstract class GlobalOption implements Option<[]> {
  readonly type = 'global';
  readonly affectsFrameState: boolean = false;
  nextState = identity;
  abstract options(): string[];
}

export abstract class ConstantGlobalOption extends GlobalOption {
  private _options: [string, ...string[]];

  constructor(options: string);
  constructor(options: [string, ...string[]]);
  constructor(options: string | [string, ...string[]]) {
    super();
    this._options = isString(options) ? [options] : options;
  }

  options(): string[] {
    return this._options;
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
