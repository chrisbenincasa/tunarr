import type { Tag } from '@tunarr/types';
import dayjs, { type Dayjs } from 'dayjs';
import ld, { filter, forEach, isString, once, reject, values } from 'lodash-es';
import { v4 } from 'uuid';
import { ServerContext } from '../serverContext.js';
import { BackupTask } from '../tasks/BackupTask.js';
import { CleanupSessionsTask } from '../tasks/CleanupSessionsTask.js';
import { OneOffTask } from '../tasks/OneOffTask.js';
import { ReconcileProgramDurationsTask } from '../tasks/ReconcileProgramDurationsTask.js';
import { ScheduleDynamicChannelsTask } from '../tasks/ScheduleDynamicChannelsTask.js';
import { ScheduledTask } from '../tasks/ScheduledTask.js';
import { Task, TaskId } from '../tasks/Task.js';
import { UpdateXmlTvTask } from '../tasks/UpdateXmlTvTask.js';
import { typedProperty } from '../types/path.js';
import { Maybe } from '../types/util.js';
import { LoggerFactory } from '../util/logging/LoggerFactory.js';
import { parseEveryScheduleRule } from '../util/schedulingUtil.js';
import { BackupSettings } from '@tunarr/types/schemas';
import { DeepReadonly } from 'ts-essentials';

const { isDayjs } = dayjs;

class Scheduler {
  #scheduledJobsById: Record<string, ScheduledTask[]> = {};

  // TaskId values always have an associated task (after server startup)
  getScheduledJobs<
    Id extends TaskId,
    OutType = Id extends Tag<TaskId, infer Out> ? Out : unknown,
  >(id: TaskId): ScheduledTask<OutType>[];
  getScheduledJobs<OutType = unknown>(
    id: string,
  ): Maybe<ScheduledTask<OutType>[]>;
  getScheduledJobs<OutType = unknown>(
    id: Task<OutType> | string,
  ): Maybe<ScheduledTask<OutType>[]> {
    if (isString(id)) {
      return this.#scheduledJobsById[id] as Maybe<ScheduledTask<OutType>[]>;
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
  getScheduledJob<
    Id extends TaskId,
    OutType = Id extends Tag<TaskId, infer Out> ? Out : unknown,
  >(id: TaskId): ScheduledTask<OutType> {
    return this.getScheduledJobs<Id, OutType>(id)[0];
  }

  // Clears all scheduled tasks for an ID and cancels them
  clearTasks(id: string) {
    if (this.#scheduledJobsById[id]) {
      forEach(this.#scheduledJobsById[id], (task) => {
        task.cancel();
      });

      this.#scheduledJobsById[id] = [];
    }
  }

  scheduleTask(id: string, task: ScheduledTask): boolean {
    this.insertTask(id, task);
    return true;
  }

  scheduleOneOffTask<OutType = unknown>(
    name: string,
    when: Dayjs | Date | number,
    task: Task<OutType>,
  ) {
    const id = `one_off_${name}`;
    const scheduledTaskName = `${name}_${v4()}`;
    task.addOnCompleteListener(() => {
      this.#scheduledJobsById[id] = reject(
        this.#scheduledJobsById[id] ?? [],
        (j) => j.name === scheduledTaskName,
      );
    });
    const ts = isDayjs(when) ? when.toDate() : when;
    this.insertTask(id, new OneOffTask(scheduledTaskName, ts, () => task));
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

export const scheduleJobs = once((serverContext: ServerContext) => {
  const xmlTvSettings = serverContext.settings.xmlTvSettings();

  GlobalScheduler.scheduleTask(
    UpdateXmlTvTask.ID,
    new ScheduledTask(
      UpdateXmlTvTask.name,
      hoursCrontab(xmlTvSettings.refreshHours),
      () => UpdateXmlTvTask.create(serverContext),
    ),
  );

  GlobalScheduler.scheduleTask(
    CleanupSessionsTask.ID,
    new ScheduledTask(
      CleanupSessionsTask.name,
      minutesCrontab(30),
      () => new CleanupSessionsTask(),
    ),
  );

  GlobalScheduler.scheduleTask(
    ScheduleDynamicChannelsTask.ID,
    new ScheduledTask(
      ScheduleDynamicChannelsTask.name,
      // Temporary
      hoursCrontab(1),
      () => ScheduleDynamicChannelsTask.create(serverContext.channelDB),
      {
        runOnSchedule: true,
      },
    ),
  );

  GlobalScheduler.scheduleTask(
    ReconcileProgramDurationsTask.ID,
    new ScheduledTask(
      ReconcileProgramDurationsTask.name,
      // temporary
      hoursCrontab(1),
      () => new ReconcileProgramDurationsTask(),
    ),
  );

  scheduleBackupJobs(serverContext.settings.backup);

  ld.chain(values(GlobalScheduler.scheduledJobsById))
    .flatten()
    .filter((job) => job.runAtStartup)
    .forEach((job) => {
      job
        .runNow(true)
        .catch((e) =>
          LoggerFactory.root.error(
            'Error running job %s at startup',
            job.name,
            e,
          ),
        );
    });
});

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
          () => new BackupTask(config),
        ),
      );
    },
  );
}

function hoursCrontab(hours: number): string {
  return `0 0 */${hours} * * *`;
}

function minutesCrontab(mins: number): string {
  return `*/${mins} * * * *`;
}
