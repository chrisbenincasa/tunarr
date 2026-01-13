import 'reflect-metadata';

import type { ArchiveDatabaseBackupFactory } from '@/db/backup/ArchiveDatabaseBackup.js';
import {
  ArchiveDatabaseBackup,
  ArchiveDatabaseBackupKey,
} from '@/db/backup/ArchiveDatabaseBackup.js';
import { CleanupSessionsTask } from '@/tasks/CleanupSessionsTask.js';
import { OnDemandChannelStateTask } from '@/tasks/OnDemandChannelStateTask.js';
import type { ReconcileProgramDurationsTaskRequest } from '@/tasks/ReconcileProgramDurationsTask.js';
import { ReconcileProgramDurationsTask } from '@/tasks/ReconcileProgramDurationsTask.js';
import { ScheduleDynamicChannelsTask } from '@/tasks/ScheduleDynamicChannelsTask.js';
import { UpdateXmlTvTask } from '@/tasks/UpdateXmlTvTask.js';
import { autoFactoryKey, KEYS } from '@/types/inject.js';
import type { interfaces } from 'inversify';
import { ContainerModule } from 'inversify';
import type { MediaSourceWithRelations } from '../db/schema/derivedTypes.js';
import { MediaSourceApiFactory } from '../external/MediaSourceApiFactory.ts';
import { bindFactoryFunc } from '../util/inject.ts';
import type { BackupTaskFactory } from './BackupTask.ts';
import { BackupTask } from './BackupTask.ts';
import { ClearM3uCacheTask } from './ClearM3uCacheTask.ts';
import { SaveJellyfinProgramExternalIdsTask } from './jellyfin/SaveJellyfinProgramExternalIdsTask.ts';
import { SavePlexProgramExternalIdsTask } from './plex/SavePlexProgramExternalIdsTask.ts';
import type {
  UpdatePlexPlayStatusScheduledTaskFactory,
  UpdatePlexPlayStatusScheduleRequest,
} from './plex/UpdatePlexPlayStatusTask.ts';
import { UpdatePlexPlayStatusScheduledTask } from './plex/UpdatePlexPlayStatusTask.ts';
import { RefreshMediaSourceLibraryTask } from './RefreshMediaSourceLibraryTask.ts';
import { RemoveDanglingProgramsFromSearchTask } from './RemoveDanglingProgramsFromSearchTask.ts';
import { ScanLibrariesTask } from './ScanLibrariesTask.ts';
import { SubtitleExtractorTask } from './SubtitleExtractorTask.ts';

export type ReconcileProgramDurationsTaskFactory = (
  request?: ReconcileProgramDurationsTaskRequest,
) => ReconcileProgramDurationsTask;

const TasksModule = new ContainerModule((bind) => {
  bind(UpdateXmlTvTask).toSelf();
  bind<interfaces.Factory<UpdateXmlTvTask>>(
    KEYS.UpdateXmlTvTaskFactory,
  ).toAutoFactory(UpdateXmlTvTask);

  bind(OnDemandChannelStateTask).toSelf();
  bind<interfaces.Factory<OnDemandChannelStateTask>>(
    OnDemandChannelStateTask.KEY,
  ).toAutoFactory(OnDemandChannelStateTask);

  bind(ScheduleDynamicChannelsTask).toSelf();
  bind<interfaces.Factory<ScheduleDynamicChannelsTask>>(
    ScheduleDynamicChannelsTask.KEY,
  ).toAutoFactory(ScheduleDynamicChannelsTask);

  bind(CleanupSessionsTask).toSelf();
  bind<interfaces.Factory<CleanupSessionsTask>>(
    CleanupSessionsTask.KEY,
  ).toAutoFactory(CleanupSessionsTask);

  bind(ScanLibrariesTask).toSelf();
  bind<interfaces.Factory<ScanLibrariesTask>>(
    ScanLibrariesTask.KEY,
  ).toAutoFactory(ScanLibrariesTask);

  bind(KEYS.Task).toService(RemoveDanglingProgramsFromSearchTask);

  bind(ReconcileProgramDurationsTask).toSelf();
  bind<interfaces.AutoFactory<ReconcileProgramDurationsTask>>(
    autoFactoryKey(ReconcileProgramDurationsTask),
  ).toAutoFactory(ReconcileProgramDurationsTask);

  bind(SavePlexProgramExternalIdsTask).toSelf();
  bind<interfaces.AutoFactory<SavePlexProgramExternalIdsTask>>(
    autoFactoryKey(SavePlexProgramExternalIdsTask),
  ).toAutoFactory(SavePlexProgramExternalIdsTask);

  bind(SaveJellyfinProgramExternalIdsTask).toSelf();
  bind<interfaces.AutoFactory<SaveJellyfinProgramExternalIdsTask>>(
    autoFactoryKey(SaveJellyfinProgramExternalIdsTask),
  ).toAutoFactory(SaveJellyfinProgramExternalIdsTask);

  bind(ClearM3uCacheTask).toSelf();

  bind<ArchiveDatabaseBackupFactory>(ArchiveDatabaseBackupKey).toAutoFactory(
    ArchiveDatabaseBackup,
  );

  bindFactoryFunc<BackupTaskFactory>(
    bind,
    BackupTask.KEY,
    (ctx) => (conf) => () =>
      new BackupTask(
        conf,
        ctx.container.get<ArchiveDatabaseBackupFactory>(
          ArchiveDatabaseBackupKey,
        ),
      ),
  );

  bindFactoryFunc<UpdatePlexPlayStatusScheduledTaskFactory>(
    bind,
    UpdatePlexPlayStatusScheduledTask.KEY,
    (ctx) =>
      (
        plexServer: MediaSourceWithRelations,
        request: UpdatePlexPlayStatusScheduleRequest,
        sessionId: string,
      ) =>
        new UpdatePlexPlayStatusScheduledTask(
          ctx.container.get<MediaSourceApiFactory>(MediaSourceApiFactory),
          plexServer,
          request,
          sessionId,
        ),
  );

  bind(SubtitleExtractorTask).toSelf();
  bind(autoFactoryKey(SubtitleExtractorTask)).toAutoFactory(
    SubtitleExtractorTask,
  );

  bind<RefreshMediaSourceLibraryTask>(RefreshMediaSourceLibraryTask).toSelf();
});

export { TasksModule };
