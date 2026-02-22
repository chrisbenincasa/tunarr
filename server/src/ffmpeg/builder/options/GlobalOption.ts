import type { FrameState } from '@/ffmpeg/builder/state/FrameState.js';
import type { GlobalOptionPipelineStep } from '@/ffmpeg/builder/types/PipelineStep.js';
import { isString } from 'lodash-es';
import type { NonEmptyArray } from 'ts-essentials';

export abstract class GlobalOption implements GlobalOptionPipelineStep {
  readonly type = 'global';

  readonly affectsFrameState: boolean = false;

  nextState(currentState: FrameState): FrameState {
    return currentState;
  }

  abstract options(): string[];
}

export abstract class ConstantGlobalOption extends GlobalOption {
  private _options: NonEmptyArray<string>;

  constructor(options: string);
  constructor(options: NonEmptyArray<string>);
  constructor(options: string | NonEmptyArray<string>) {
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

export class StandardFormatFlags extends ConstantGlobalOption {
  constructor() {
    super(['-fflags', '+genpts+discardcorrupt+igndts']);
  }
}
