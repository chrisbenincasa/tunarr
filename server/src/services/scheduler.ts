import type { Tag } from '@tunarr/types';
import dayjs, { type Dayjs } from 'dayjs';
import ld, { isString, once, pickBy, values } from 'lodash-es';
import { v4 } from 'uuid';
import { ServerContext } from '../serverContext.js';
import { OneOffTask } from '../tasks/OneOffTask.js';
import { ReconcileProgramDurationsTask } from '../tasks/ReconcileProgramDurationsTask.js';
import { ScheduledTask } from '../tasks/ScheduledTask.js';
import { Task, TaskId } from '../tasks/Task.js';
import { CleanupSessionsTask } from '../tasks/CleanupSessionsTask.js';
import { ScheduleDynamicChannelsTask } from '../tasks/ScheduleDynamicChannelsTask.js';
import { UpdateXmlTvTask } from '../tasks/UpdateXmlTvTask.js';
import { typedProperty } from '../types/path.js';
import { Maybe } from '../types/util.js';
import { LoggerFactory } from '../util/logging/LoggerFactory.js';

const { isDayjs } = dayjs;

class Scheduler {
  #scheduledJobsById: Record<string, ScheduledTask> = {};

  // TaskId values always have an associated task (after server startup)
  getScheduledJob<
    Id extends TaskId,
    OutType = Id extends Tag<TaskId, infer Out> ? Out : unknown,
  >(id: TaskId): ScheduledTask<OutType>;
  getScheduledJob<OutType = unknown>(id: string): Maybe<ScheduledTask<OutType>>;
  getScheduledJob<OutType = unknown>(
    id: Task<OutType> | string,
  ): Maybe<ScheduledTask<OutType>> {
    if (isString(id)) {
      return this.#scheduledJobsById[id] as Maybe<ScheduledTask<OutType>>;
    } else {
      return this.getScheduledJob(id.ID);
    }
  }

  scheduleTask(
    id: string,
    task: ScheduledTask,
    overwrite: boolean = true,
  ): boolean {
    if (!overwrite && this.#scheduledJobsById[id]) {
      return false;
    }

    this.#scheduledJobsById[id] = task;
    return true;
  }

  scheduleOneOffTask<OutType = unknown>(
    name: string,
    when: Dayjs | Date | number,
    task: Task<OutType>,
  ) {
    const id = `one_off_${name}_${v4()}`;
    task.addOnCompleteListener(() => {
      delete this.#scheduledJobsById[id];
    });
    const ts = isDayjs(when) ? when.toDate() : when;
    this.#scheduledJobsById[id] = new OneOffTask(name, ts, () => task);
  }

  get scheduledJobsById(): Record<string, ScheduledTask> {
    return pickBy(this.#scheduledJobsById, typedProperty('visible'));
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

  ld.chain(values(GlobalScheduler.scheduledJobsById))
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

function hoursCrontab(hours: number): string {
  return `0 0 */${hours} * * *`;
}

function minutesCrontab(mins: number): string {
  return `*/${mins} * * * *`;
}
