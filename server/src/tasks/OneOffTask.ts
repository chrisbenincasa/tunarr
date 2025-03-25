import type { TaskFactoryFn } from './ScheduledTask.ts';
import { ScheduledTask } from './ScheduledTask.ts';

export class OneOffTask<
  Args extends unknown[] = unknown[],
  OutType = unknown,
> extends ScheduledTask<Args, OutType> {
  constructor(
    jobName: string,
    when: Date | number,
    taskFactory: TaskFactoryFn<OutType, Args>,
    presetArgs: Args,
  ) {
    super(jobName, when, taskFactory, presetArgs, { visible: false });
  }
}
