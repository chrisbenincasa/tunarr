import type { Tag } from '@tunarr/types';
import { isError, isString, round } from 'lodash-es';
import { Maybe } from '../types/util.js';
import {
  LogLevels,
  Logger,
  LoggerFactory,
} from '../util/logging/LoggerFactory.js';
import { withDb } from '../dao/dataSource.js';
import { isNonEmptyString } from '../util/index.js';

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
  private _logLevel: LogLevels = 'debug';

  protected hasRun: boolean = false;
  protected result: Maybe<Data>;

  public abstract ID: string | Tag<TaskId, Data>;

  constructor() {
    this.logger = LoggerFactory.child({ caller: import.meta });
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
      this.result = await withDb(() => this.runInternal());
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
        'Task %s ran in %d ms and failed. Error = %O',
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

    // eslint-disable-next-line @typescript-eslint/require-await
    protected async runInternal() {
      return runnable();
    }
  })();
}
