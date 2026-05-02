import { isNonEmptyString } from '@/util/index.js';
import type { Tag } from '@tunarr/types';
import { isError, isString, round } from 'lodash-es';
import z from 'zod';
import { TypedError } from '../types/errors.ts';
import { Result } from '../types/result.ts';
import { InjectLogger } from '../util/inject.js';
import type { LogLevels, Logger } from '../util/logging/LoggerFactory.js';

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

export type TaskOutputType<Id, Default = void> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Id extends Tag<Id, TaskMetadata<any, infer Out>> ? Out : Default;

const emptyRequestSchema = z.undefined();

export type TaskConstructor<
  Schema extends z.ZodType,
  ResultT = void,
  TaskType extends Task2<Schema, ResultT> = Task2<Schema, ResultT>,
> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  new (...args: any[]): TaskType;
};

export type GenericTask = Task2<z.ZodUnknown, unknown>;

export abstract class Task2<
  RequestSchema extends z.ZodType = typeof emptyRequestSchema,
  ResultT = void,
> {
  public abstract readonly ID: string;
  abstract readonly schema: RequestSchema;
  private _logLevel: LogLevels = 'trace';

  @InjectLogger() declare protected readonly logger: Logger;

  constructor() {}

  async run(request: z.infer<RequestSchema>): Promise<Result<ResultT>> {
    this.logger[this._logLevel](
      'Running task %s',
      isNonEmptyString(this.constructor.name)
        ? this.constructor.name
        : this.taskName,
    );
    const start = performance.now();
    try {
      const result = await this.runInternal(request);
      const duration = round(performance.now() - start, 2);
      this.logger[this._logLevel]('Task %s ran in %d ms', this.name, duration);
      return Result.success(result);
    } catch (e) {
      const error = isError(e) ? e : new Error(isString(e) ? e : 'Unknown');
      const duration = round(performance.now() - start, 2);
      this.logger.warn(
        error,
        'Task %s ran in %d ms and failed',
        this.name,
        duration,
      );
      return Result.forError(TypedError.fromAny(e));
    }
  }

  protected abstract runInternal(
    request: z.infer<RequestSchema>,
  ): Promise<ResultT>;

  set logLevel(level: LogLevels) {
    this._logLevel = level;
  }

  get taskName(): string {
    return this.ID;
  }

  private get name() {
    return isNonEmptyString(this.constructor.name)
      ? this.constructor.name
      : this.taskName;
  }
}

export abstract class SimpleTask<ResultT = void> extends Task2<
  typeof emptyRequestSchema,
  ResultT
> {
  ID = this.constructor.name;

  readonly schema = emptyRequestSchema;
}
