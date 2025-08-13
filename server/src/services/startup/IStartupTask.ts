import type { Maybe } from '../../types/util.ts';

// Right now all tasks are of equal importance
export interface IStartupTask {
  dependencies: string[];
  id: string;
  start(): void;
  wait(): Promise<void>;
}

export abstract class SimpleStartupTask implements IStartupTask {
  private promise: Maybe<Promise<void>>;

  abstract dependencies: string[];
  abstract id: string;

  start(): void {
    if (!this.promise) {
      this.promise = this.getPromise();
    }
  }

  wait(): Promise<void> {
    if (!this.promise) {
      this.start();
    }

    return this.promise!;
  }

  abstract getPromise(): Promise<void>;
}
