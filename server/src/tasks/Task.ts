import type { Maybe } from '@/types/util.js';
import { isNonEmptyString } from '@/util/index.js';
import type { Tag } from '@tunarr/types';
import { isError, isString, round } from 'lodash-es';
import type { LogLevels, Logger } from '../util/logging/LoggerFactory.js';
import { LoggerFactory } from '../util/logging/LoggerFactory.js';

// Set of all of the possible Task IDs
export type TaskId =
  | 'update-xmltv'
  | 'cleanup-sessions'
  | 'schedule-dynamic-channels'
  | 'on-demand-channel-state';

export abstract class Task<Data = unknown> {
  protected logger: Logger;
  private onCompleteListeners = new Set<() => void>();
  private running_ = false;
  private _logLevel: LogLevels = 'trace';

  protected hasRun: boolean = false;
  protected result: Maybe<Data>;

  public abstract ID: string | Tag<TaskId, Data>;

  constructor(logger?: Logger) {
    this.logger =
      logger ?? LoggerFactory.child({ className: this.constructor.name });
  }

  protected abstract runInternal(): Promise<Maybe<Data>>;

  async run(): Promise<Maybe<Data>> {
    this.running_ = true;
    this.logger[this._logLevel](
      'Running task %s',
      isNonEmptyString(this.constructor.name)
        ? this.constructor.name
        : this.taskName,
    );
    const start = performance.now();
    try {
      this.result = await this.runInternal();
      const duration = round(performance.now() - start, 2);
      this.logger[this._logLevel](
        'Task %s ran in %d ms',
        isNonEmptyString(this.constructor.name)
          ? this.constructor.name
          : this.taskName,
        duration,
      );
    } catch (e) {
      const error = isError(e) ? e : new Error(isString(e) ? e : 'Unknown');
      const duration = round(performance.now() - start, 2);
      this.logger.warn(
        error,
        'Task %s ran in %d ms and failed',
        this.constructor.name,
        duration,
      );
      return;
    } finally {
      this.hasRun = true;
      this.running_ = false;
    }

    return this.result;
  }

  getResult(): Maybe<Data> {
    return this.result;
  }

  get running() {
    return this.running_;
  }

  get taskName(): string {
    return this.ID;
  }

  addOnCompleteListener(listener: () => void) {
    return this.onCompleteListeners.add(listener);
  }

  set logLevel(level: LogLevels) {
    this._logLevel = level;
  }
}

export function AnonymousTask<OutType = unknown>(
  id: string,
  runnable: () => Promise<OutType>,
): Task<OutType> {
  return new (class extends Task<OutType> {
    public ID = id;

    get taskName() {
      return `AnonymousTest_` + id;
    }

    protected async runInternal() {
      return runnable();
    }
  })(LoggerFactory.child({ className: `AnonymousTask`, caller: import.meta }));
}
