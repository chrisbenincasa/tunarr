import type z from 'zod';
import { GlobalScheduler } from '../services/Scheduler.ts';
import type { WrappedError } from '../types/errors.ts';
import type { Result } from '../types/result.ts';
import type { Task2FactoryFn } from './ScheduledTask.ts';
import { ScheduledTask } from './ScheduledTask.ts';

export class OneOffTask<
  RequestTypeT extends z.ZodType = z.ZodUnknown,
  OutTypeT = unknown,
> extends ScheduledTask<RequestTypeT, OutTypeT> {
  constructor(
    jobName: string,
    when: Date | number,
    taskFactory: Task2FactoryFn<RequestTypeT, OutTypeT>,
    presetArgs: z.infer<RequestTypeT>,
  ) {
    super(jobName, when, taskFactory, presetArgs, { visible: false });
  }

  protected run(): Promise<Result<OutTypeT, WrappedError>> {
    try {
      return this.runJobInternal();
    } finally {
      GlobalScheduler.clearTasks(this.name);
    }
  }
}
