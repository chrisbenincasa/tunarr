import { inject, injectable, interfaces } from 'inversify';
import { filter, flatten, forEach, values } from 'lodash-es';
import { container } from '../../container.ts';
import { ISettingsDB } from '../../db/interfaces/ISettingsDB.ts';
import { CleanupSessionsTask } from '../../tasks/CleanupSessionsTask.ts';
import { OnDemandChannelStateTask } from '../../tasks/OnDemandChannelStateTask.ts';
import { RefreshMediaSourceLibraryTask } from '../../tasks/RefreshMediaSourceLibraryTask.ts';
import { ScanLibrariesTask } from '../../tasks/ScanLibrariesTask.ts';
import { ScheduledTask } from '../../tasks/ScheduledTask.ts';
import { ScheduleDynamicChannelsTask } from '../../tasks/ScheduleDynamicChannelsTask.ts';
import {
  SubtitleExtractorTask,
  SubtitleExtractorTaskFactory,
} from '../../tasks/SubtitleExtractorTask.ts';
import { UpdateXmlTvTask } from '../../tasks/UpdateXmlTvTask.ts';
import { KEYS } from '../../types/inject.ts';
import { Logger, LoggerFactory } from '../../util/logging/LoggerFactory.ts';
import {
  GlobalScheduler,
  hoursCrontab,
  minutesCrontab,
  scheduleBackupJobs,
} from '../Scheduler.ts';
import { ChannelLineupMigratorStartupTask } from './ChannelLineupMigratorStartupTask.ts';
import { SimpleStartupTask } from './IStartupTask.ts';

@injectable()
export class ScheduleJobsStartupTask extends SimpleStartupTask {
  id = ScheduleJobsStartupTask.name;
  dependencies = [ChannelLineupMigratorStartupTask.name];

  constructor(
    @inject(KEYS.SettingsDB) private settingsDB: ISettingsDB,
    @inject(KEYS.Logger) private logger: Logger,
  ) {
    super();
  }

  getPromise(): Promise<void> {
    const xmlTvSettings = this.settingsDB.xmlTvSettings();

    GlobalScheduler.scheduleTask(
      UpdateXmlTvTask.ID,
      new ScheduledTask(
        UpdateXmlTvTask.name,
        hoursCrontab(xmlTvSettings.refreshHours),
        container.get<interfaces.AutoFactory<UpdateXmlTvTask>>(
          KEYS.UpdateXmlTvTaskFactory,
        ),
        [],
      ),
    );

    GlobalScheduler.scheduleTask(
      CleanupSessionsTask.ID,
      new ScheduledTask(
        CleanupSessionsTask.name,
        minutesCrontab(1),
        container.get<interfaces.AutoFactory<CleanupSessionsTask>>(
          CleanupSessionsTask.KEY,
        ),
        [],
      ),
    );

    GlobalScheduler.scheduleTask(
      OnDemandChannelStateTask.ID,
      new ScheduledTask(
        OnDemandChannelStateTask.name,
        minutesCrontab(1),
        container.get<interfaces.AutoFactory<OnDemandChannelStateTask>>(
          OnDemandChannelStateTask.KEY,
        ),
        [],
        { runAtStartup: true },
      ),
    );

    GlobalScheduler.scheduleTask(
      ScheduleDynamicChannelsTask.ID,
      new ScheduledTask(
        ScheduleDynamicChannelsTask.name,
        // Temporary
        hoursCrontab(1),
        container.get<interfaces.AutoFactory<ScheduleDynamicChannelsTask>>(
          ScheduleDynamicChannelsTask.KEY,
        ),
        [],
        {
          runAtStartup: true,
          runOnSchedule: true,
        },
      ),
    );

    GlobalScheduler.scheduleTask(
      SubtitleExtractorTask.ID,
      new ScheduledTask(
        SubtitleExtractorTask.name,
        hoursCrontab(1),
        () =>
          container.get<SubtitleExtractorTaskFactory>(
            SubtitleExtractorTask.KEY,
          )({}),
        [],
        {
          runAtStartup: true,
        },
      ),
    );

    GlobalScheduler.scheduleTask(
      RefreshMediaSourceLibraryTask.ID,
      new ScheduledTask(
        RefreshMediaSourceLibraryTask.ID,
        hoursCrontab(1),
        () =>
          container.get<RefreshMediaSourceLibraryTask>(
            RefreshMediaSourceLibraryTask,
          ),
        [],
      ),
    );

    GlobalScheduler.scheduleTask(
      ScanLibrariesTask.ID,
      new ScheduledTask(
        ScanLibrariesTask.name,
        hoursCrontab(
          this.settingsDB.globalMediaSourceSettings().rescanIntervalHours,
        ),
        container.get<interfaces.AutoFactory<ScanLibrariesTask>>(
          ScanLibrariesTask.KEY,
        ),
        [],
      ),
    );

    scheduleBackupJobs(this.settingsDB.backup);

    forEach(
      filter(
        flatten(values(GlobalScheduler.scheduledJobsById)),
        (job) => job.runAtStartup,
      ),
      (job) => {
        this.logger.debug('Running startup task %s', job.name);
        job
          .runNow(true)
          .catch((e) =>
            LoggerFactory.root.error(
              e,
              'Error running job %s at startup',
              job.name,
            ),
          );
      },
    );

    return Promise.resolve();
  }
}
