import type { Maybe } from '@/types/util.js';
import { isNonEmptyString } from '@/util/index.js';
import type { Tag } from '@tunarr/types';
import { isError, isString, round } from 'lodash-es';
import type { LogLevels, Logger } from '../util/logging/LoggerFactory.js';
import { LoggerFactory } from '../util/logging/LoggerFactory.js';

export type TaskId<Args extends unknown[] = [], Data = unknown> =
  | string
  | Tag<string, TaskMetadata<Args, Data>>;

export type TaskMetadata<
  Args extends unknown[] = unknown[],
  OutType = unknown,
> = {
  args: Args;
  out: OutType;
};

export type TaskArgsType<Id, Default = unknown[]> =
  Id extends Tag<Id, TaskMetadata<infer Args, unknown>>
    ? Args extends unknown[]
      ? Args
      : Default
    : Default;

export type TaskOutputType<Id, Default = void> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Id extends Tag<Id, TaskMetadata<any, infer Out>> ? Out : Default;

export type TaskType<Id> =
  Id extends Tag<Id, TaskMetadata<infer Args, infer Out>>
    ? Task<Args, Out>
    : Task;

export type TaskFactory<
  Id extends TaskId,
  ArgsType extends unknown[] = TaskArgsType<Id>,
  OutType = TaskOutputType<Id>,
> = (...args: ArgsType) => Task<ArgsType, OutType>;

export abstract class Task<Args extends unknown[] = [], Data = unknown> {
  protected logger: Logger;
  private onCompleteListeners = new Set<() => void>();
  private running_ = false;
  private _logLevel: LogLevels = 'trace';

  protected hasRun: boolean = false;
  protected result: Maybe<Data>;

  public abstract ID: string | Tag<string, TaskMetadata<Args, Data>>;

  constructor(logger?: Logger) {
    logger?.setBindings({ caller: this.constructor.name });
    this.logger =
      logger ?? LoggerFactory.child({ className: this.constructor.name });
  }

  protected abstract runInternal(...args: Args): Promise<Maybe<Data>>;

  async run(...args: Args): Promise<Maybe<Data>> {
    this.running_ = true;
    this.logger[this._logLevel](
      'Running task %s',
      isNonEmptyString(this.constructor.name)
        ? this.constructor.name
        : this.taskName,
    );
    const start = performance.now();
    try {
      this.result = await this.runInternal(...args);
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
): Task<[], OutType> {
  return new (class extends Task<[], OutType> {
    public ID = id;

    get taskName() {
      return `AnonymousTest_` + id;
    }

    protected async runInternal() {
      return runnable();
    }
  })(LoggerFactory.child({ className: `AnonymousTask`, caller: import.meta }));
}
