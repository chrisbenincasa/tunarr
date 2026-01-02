import { container } from '@/container.js';
import type { BackupTaskFactory } from '@/tasks/BackupTask.js';
import { BackupTask } from '@/tasks/BackupTask.js';
import { OneOffTask } from '@/tasks/OneOffTask.js';
import { ScheduledTask } from '@/tasks/ScheduledTask.js';
import type { Task, TaskId, TaskOutputType } from '@/tasks/Task.js';
import { typedProperty } from '@/types/path.js';
import type { Maybe } from '@/types/util.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import { parseEveryScheduleRule } from '@/util/schedulingUtil.js';
import type { BackupSettings } from '@tunarr/types/schemas';
import dayjs, { type Dayjs } from 'dayjs';
import type { interfaces } from 'inversify';
import { filter, forEach, isString, reject } from 'lodash-es';
import PQueue from 'p-queue';
import type { DeepReadonly } from 'ts-essentials';
import { v4 } from 'uuid';

const { isDayjs } = dayjs;

class Scheduler {
  private static immediateExecuteQueue = new PQueue({ concurrency: 3 });
  private logger = LoggerFactory.child({ className: Scheduler.name });
  #scheduledJobsById: Record<string, ScheduledTask[]> = {};

  // TaskId values always have an associated task (after server startup)
  getScheduledJobs<Id extends TaskId, TaskOutputTypeT = TaskOutputType<Id>>(
    id: Id,
  ): ScheduledTask<unknown[], TaskOutputTypeT>[];
  getScheduledJobs<OutType = void>(
    id: string,
  ): Maybe<ScheduledTask<unknown[], OutType>[]>;
  getScheduledJobs<OutType = void>(
    id: Task<[], OutType> | string,
  ): Maybe<ScheduledTask<unknown[], OutType>[]> {
    if (isString(id)) {
      return this.#scheduledJobsById[id] as Maybe<
        ScheduledTask<unknown[], OutType>[]
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
  ): ScheduledTask<unknown[], TaskOutputTypeT> {
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

      this.#scheduledJobsById[id] = [];
    }
  }

  scheduleTask(id: string, task: ScheduledTask): boolean {
    this.insertTask(id, task);
    this.logger.debug('Scheduled task %s', task.name);
    return true;
  }

  runTask<TaskT extends Task>(task: TaskT) {
    Scheduler.immediateExecuteQueue
      .add(() => task.run())
      .catch((e) => {
        this.logger.error(e, 'Error running task: %O', task);
      });
  }

  scheduleOneOffTask<
    TaskT extends Task,
    Args extends unknown[] = TaskT extends Task<infer Args, unknown>
      ? Args
      : unknown[],
  >(
    name: interfaces.ServiceIdentifier,
    when: Dayjs | Date | number,
    args: Args,
    taskInstance?: TaskT,
  ): void {
    let task: TaskT;
    if (taskInstance) {
      task = taskInstance;
    } else {
      const taskFactory = container.tryGet<interfaces.AutoFactory<TaskT>>(name);
      if (!taskFactory) {
        this.logger.error(
          'Unable to schedule unknown task: %s',
          name.toString(),
        );
        return;
      }

      task = taskFactory();
    }
    const id = `one_off_${name.toString()}`;
    const scheduledTaskName = `${name.toString()}_${v4()}`;
    task.addOnCompleteListener(() => {
      this.#scheduledJobsById[id] = reject(
        this.#scheduledJobsById[id] ?? [],
        (j) => j.name === scheduledTaskName,
      );
    });
    const ts = isDayjs(when) ? when.toDate() : when;
    this.insertTask(
      id,
      new OneOffTask<Args, unknown>(scheduledTaskName, ts, () => task, args),
    );
  }

  private insertTask(id: string, task: ScheduledTask) {
    if (!this.#scheduledJobsById[id]) {
      this.#scheduledJobsById[id] = [];
    }
    this.#scheduledJobsById[id].push(task);
  }

  get scheduledJobsById(): Record<string, ScheduledTask[]> {
    const ret: Record<string, ScheduledTask[]> = {};
    forEach(this.#scheduledJobsById, (tasks, key) => {
      const visibleTasks = filter(tasks, typedProperty('visible'));
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
          cronSchedule = parseEveryScheduleRule(config.schedule);
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
          BackupTask.name,
          cronSchedule,
          container.get<BackupTaskFactory>(BackupTask.KEY)(config),
          [],
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
