import { container } from '@/container.js';
import type { BackupTaskFactory } from '@/tasks/BackupTask.js';
import { BackupTask } from '@/tasks/BackupTask.js';
import { OneOffTask } from '@/tasks/OneOffTask.js';
import type { UnknownScheduledTask } from '@/tasks/ScheduledTask.js';
import { ScheduledTask } from '@/tasks/ScheduledTask.js';
import type { Task, Task2, TaskId, TaskOutputType } from '@/tasks/Task.js';
import type { Maybe } from '@/types/util.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import { scheduleRuleToCronString } from '@/util/schedulingUtil.js';
import type { BackupSettings } from '@tunarr/types/schemas';
import dayjs, { type Dayjs } from 'dayjs';
import type { interfaces } from 'inversify';
import { filter, forEach, isString } from 'lodash-es';
import PQueue from 'p-queue';
import type { DeepReadonly } from 'ts-essentials';
import { v4 } from 'uuid';
import type z from 'zod';

const { isDayjs } = dayjs;

class Scheduler {
  private static immediateExecuteQueue = new PQueue({ concurrency: 3 });
  private logger = LoggerFactory.child({ className: Scheduler.name });
  #scheduledJobsById: Record<string, UnknownScheduledTask[]> = {};

  // TaskId values always have an associated task (after server startup)
  getScheduledJobs<Id extends TaskId, TaskOutputTypeT = TaskOutputType<Id>>(
    id: Id,
  ): ScheduledTask<z.ZodUnknown, TaskOutputTypeT>[];
  getScheduledJobs<OutType = void>(
    id: string,
  ): Maybe<ScheduledTask<z.ZodUnknown, OutType>[]>;
  getScheduledJobs<OutType = void>(
    id: Task<[], OutType> | string,
  ): Maybe<ScheduledTask<z.ZodUnknown, OutType>[]> {
    if (isString(id)) {
      return this.#scheduledJobsById[id] as Maybe<
        ScheduledTask<z.ZodUnknown, OutType>[]
      >;
    } else {
      return this.getScheduledJobs(id.ID);
    }
  }

  // Used for jobs where we know:
  // 1. there is only one instance of them
  // 2. they are always scheduled (below)
  // TODO: There is probably a better way to handle the jobs that always
  // exists with a single instance vs. one-off jobs that are triggered
  // around the codebase (dynamic jobs)
  getScheduledJob<Id extends TaskId, TaskOutputTypeT = TaskOutputType<Id>>(
    id: Id,
  ): ScheduledTask<z.ZodUnknown, TaskOutputTypeT> {
    return this.getScheduledJobs<Id, TaskOutputTypeT>(id)[0]!;
  }

  runScheduledJobNow<Id extends TaskId, OutType = TaskOutputType<Id>>(
    id: Id,
    background?: boolean,
  ): Promise<OutType | undefined> {
    return this.getScheduledJob<Id, OutType>(id)?.runNow(background);
  }

  // Clears all scheduled tasks for an ID and cancels them
  clearTasks(id: string) {
    if (this.#scheduledJobsById[id]) {
      forEach(this.#scheduledJobsById[id], (task) => {
        task.removeFromSchedule();
      });

      delete this.#scheduledJobsById[id];
    }
  }

  scheduleTask<InputTypeT extends z.ZodType, OutputT>(
    id: string,
    task: ScheduledTask<InputTypeT, OutputT>,
  ): boolean {
    this.insertTask(id, task);
    this.logger.debug('Scheduled task %s', task.name);
    return true;
  }

  runTask<InputT extends z.ZodType>(
    task: Task2<InputT>,
    request: z.infer<InputT>,
  ) {
    Scheduler.immediateExecuteQueue
      .add(() => task.run(request))
      .catch((e) => {
        this.logger.error(e, 'Error running task: %O', task);
      });
  }

  scheduleOneOffTask<InputTypeT extends z.ZodType = z.ZodUnknown>(
    name: interfaces.ServiceIdentifier,
    when: Dayjs | Date | number,
    args: z.infer<InputTypeT>,
    taskInstance?: Task2<InputTypeT, unknown>,
  ): void {
    let task: Task2<InputTypeT, unknown>;
    if (taskInstance) {
      task = taskInstance;
    } else {
      const taskFactory =
        container.tryGet<interfaces.AutoFactory<Task2<InputTypeT, unknown>>>(
          name,
        );
      if (!taskFactory) {
        this.logger.error(
          'Unable to schedule unknown task: %s',
          name.toString(),
        );
        return;
      }

      task = taskFactory();
    }
    const scheduledTaskName = `${name.toString()}_${v4()}`;
    const ts = isDayjs(when) ? when.toDate() : when;
    const oneoff = new OneOffTask<z.ZodType, unknown>(
      scheduledTaskName,
      ts,
      () => task,
      args,
    );
    this.insertTask(scheduledTaskName, oneoff);
  }

  private insertTask(id: string, task: UnknownScheduledTask) {
    if (!this.#scheduledJobsById[id]) {
      this.#scheduledJobsById[id] = [];
    }
    this.#scheduledJobsById[id].push(task);
  }

  get scheduledJobsById(): Record<string, UnknownScheduledTask[]> {
    const ret: Record<string, UnknownScheduledTask[]> = {};
    forEach(this.#scheduledJobsById, (tasks, key) => {
      const visibleTasks = tasks.filter((task) => task.visible);
      if (visibleTasks.length > 0) {
        ret[key] = visibleTasks;
      }
    });
    return ret;
  }
}

export const GlobalScheduler = new Scheduler();

export function scheduleBackupJobs(
  backupConfig: BackupSettings | DeepReadonly<BackupSettings>,
) {
  GlobalScheduler.clearTasks(BackupTask.name);

  const backupConfigs = backupConfig.configurations;
  forEach(
    filter(
      backupConfigs,
      (config) => config.enabled && config.outputs.length > 0,
    ),
    (config) => {
      let cronSchedule: string;
      switch (config.schedule.type) {
        case 'every': {
          cronSchedule = scheduleRuleToCronString(config.schedule);
          break;
        }
        case 'cron': {
          cronSchedule = config.schedule.cron;
          break;
        }
      }

      GlobalScheduler.scheduleTask(
        BackupTask.name,
        new ScheduledTask(
          BackupTask,
          cronSchedule,
          container.get<BackupTaskFactory>(BackupTask.KEY)(config),
          undefined,
          {},
        ),
      );
    },
  );
}

export function hoursCrontab(hours: number): string {
  return `0 0 */${hours} * * *`;
}

export function minutesCrontab(mins: number): string {
  return `*/${mins} * * * *`;
}
