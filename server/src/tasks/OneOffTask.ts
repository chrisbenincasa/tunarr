import { ScheduledTask, TaskFactoryFn } from './ScheduledTask';

export class OneOffTask<OutType = unknown> extends ScheduledTask<OutType> {
  constructor(
    jobName: string,
    when: Date | number,
    taskFactory: TaskFactoryFn<OutType>,
  ) {
    super(jobName, when, taskFactory, { visible: false });
  }
}
