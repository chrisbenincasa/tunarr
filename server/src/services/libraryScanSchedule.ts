import type { LibraryScanSchedule } from '@tunarr/types/schemas';
import type { DeepReadonly } from 'ts-essentials';
import { container } from '../container.ts';
import { ScanLibrariesTask } from '../tasks/ScanLibrariesTask.ts';
import { ScheduledTask } from '../tasks/ScheduledTask.ts';
import { SyncCollectionsTask } from '../tasks/SyncCollectionsTask.ts';
import { SyncCustomShowsTask } from '../tasks/SyncCustomShowsTask.ts';
import { LoggerFactory } from '../util/logging/LoggerFactory.ts';
import {
  isValidCronExpression,
  libraryScanScheduleToCron,
} from '../util/schedulingUtil.ts';
import { GlobalScheduler } from './Scheduler.ts';

/**
 * Replaces the scheduled library scan and the collection and playlist syncs,
 * which all run on the global scan schedule.
 */
export function scheduleLibraryScanJobs(
  schedule: DeepReadonly<LibraryScanSchedule>,
) {
  const logger = LoggerFactory.child({ className: 'LibraryScanSchedule' });

  GlobalScheduler.clearTasks(ScanLibrariesTask.ID);
  GlobalScheduler.clearTasks(SyncCollectionsTask.ID);
  GlobalScheduler.clearTasks(SyncCustomShowsTask.ID);

  const cron = libraryScanScheduleToCron(schedule);
  if (cron === null) {
    logger.info('Scheduled library scans are off');
    return;
  }

  if (!isValidCronExpression(cron)) {
    logger.error(
      'Library scan schedule "%s" is not a valid cron expression. Scheduled scans are off until it is fixed.',
      cron,
    );
    return;
  }

  GlobalScheduler.scheduleTask(
    ScanLibrariesTask.ID,
    new ScheduledTask(
      ScanLibrariesTask,
      cron,
      () => container.get<() => ScanLibrariesTask>(ScanLibrariesTask.KEY)(),
      undefined,
    ),
  );

  GlobalScheduler.scheduleTask(
    SyncCollectionsTask.ID,
    new ScheduledTask(
      SyncCollectionsTask,
      cron,
      () => container.get<() => SyncCollectionsTask>(SyncCollectionsTask.KEY)(),
      undefined,
    ),
  );

  GlobalScheduler.scheduleTask(
    SyncCustomShowsTask.ID,
    new ScheduledTask(
      SyncCustomShowsTask,
      cron,
      () => container.get<() => SyncCustomShowsTask>(SyncCustomShowsTask.KEY)(),
      undefined,
    ),
  );
}
