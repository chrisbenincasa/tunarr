import 'reflect-metadata';

import type { ArchiveDatabaseBackupFactory } from '@/db/backup/ArchiveDatabaseBackup.js';
import {
  ArchiveDatabaseBackup,
  ArchiveDatabaseBackupKey,
} from '@/db/backup/ArchiveDatabaseBackup.js';
import { CleanupSessionsTask } from '@/tasks/CleanupSessionsTask.js';
import { OnDemandChannelStateTask } from '@/tasks/OnDemandChannelStateTask.js';
import { ReconcileProgramDurationsTask } from '@/tasks/ReconcileProgramDurationsTask.js';
import { UpdateXmlTvTask } from '@/tasks/UpdateXmlTvTask.js';
import { autoFactoryKey, factoryKey, KEYS } from '@/types/inject.js';
import type { BackupConfiguration } from '@tunarr/types/schemas';
import type { Factory } from 'inversify';
import { ContainerModule } from 'inversify';
import type { DeepReadonly } from 'ts-essentials';
import type { ISettingsDB } from '../db/interfaces/ISettingsDB.ts';
import type { MediaSourceWithRelations } from '../db/schema/derivedTypes.js';
import { MediaSourceApiFactory } from '../external/MediaSourceApiFactory.ts';
import { bindAutoFactory, bindFactoryFunc } from '../util/inject.ts';
import { LoggerFactory } from '../util/logging/LoggerFactory.ts';
import { BackupTask } from './BackupTask.ts';
import { ClearM3uCacheTask } from './ClearM3uCacheTask.ts';
import { NoopTask } from './NoopTask.ts';
import type {
  UpdatePlexPlayStatusScheduledTaskFactory,
  UpdatePlexPlayStatusScheduleRequest,
} from './plex/UpdatePlexPlayStatusTask.ts';
import { UpdatePlexPlayStatusScheduledTask } from './plex/UpdatePlexPlayStatusTask.ts';
import { RefreshMediaSourceLibraryTask } from './RefreshMediaSourceLibraryTask.ts';
import { RemoveDanglingProgramsFromSearchTask } from './RemoveDanglingProgramsFromSearchTask.ts';
import { RollLogFileTask } from './RollLogFileTask.ts';
import { ScanLibrariesTask } from './ScanLibrariesTask.ts';
import { SubtitleExtractorTask } from './SubtitleExtractorTask.ts';
import { SyncCollectionsTask } from './SyncCollectionsTask.ts';
import { SyncCustomShowsTask } from './SyncCustomShowsTask.ts';

const TasksModule = new ContainerModule(({ bind }) => {
  bind(UpdateXmlTvTask).toSelf();
  bindAutoFactory(bind, KEYS.UpdateXmlTvTaskFactory, UpdateXmlTvTask);

  bind(OnDemandChannelStateTask).toSelf();
  bindAutoFactory(bind, OnDemandChannelStateTask.KEY, OnDemandChannelStateTask);

  bind(CleanupSessionsTask).toSelf();
  bindAutoFactory(bind, CleanupSessionsTask.KEY, CleanupSessionsTask);

  bind(ScanLibrariesTask).toSelf();
  bindAutoFactory(bind, ScanLibrariesTask.KEY, ScanLibrariesTask);

  bind(SyncCollectionsTask).toSelf();
  bindAutoFactory(bind, SyncCollectionsTask.KEY, SyncCollectionsTask);

  bind(KEYS.Task).toService(RemoveDanglingProgramsFromSearchTask);

  bind(ReconcileProgramDurationsTask).toSelf();
  bindAutoFactory(
    bind,
    autoFactoryKey(ReconcileProgramDurationsTask),
    ReconcileProgramDurationsTask,
  );

  bind(ClearM3uCacheTask).toSelf();

  bindAutoFactory<ArchiveDatabaseBackupFactory>(
    bind,
    ArchiveDatabaseBackupKey,
    ArchiveDatabaseBackup,
  );

  bind(RollLogFileTask).toSelf();

  bind<Factory<() => BackupTask, [DeepReadonly<BackupConfiguration>]>>(
    factoryKey(BackupTask),
  ).toFactory(
    (ctx) => (conf) => () =>
      new BackupTask(
        conf,
        ctx.get<ArchiveDatabaseBackupFactory>(ArchiveDatabaseBackupKey),
      ),
  );

  bind<Factory<BackupTask | NoopTask>>(autoFactoryKey(BackupTask)).toFactory(
    (ctx) => {
      return () => {
        const backupConfs = ctx.get<ISettingsDB>(KEYS.SettingsDB).backup
          .configurations;
        const firstEnabledConf = backupConfs.find((conf) => conf.enabled);
        if (!firstEnabledConf) {
          LoggerFactory.root.info(
            'There are no enabled backup configurations. Skipping task.',
          );
          return new NoopTask();
        }

        return new BackupTask(
          firstEnabledConf,
          ctx.get<ArchiveDatabaseBackupFactory>(ArchiveDatabaseBackupKey),
        );
      };
    },
  );

  bindFactoryFunc<
    UpdatePlexPlayStatusScheduledTask,
    Parameters<UpdatePlexPlayStatusScheduledTaskFactory>
  >(
    bind,
    UpdatePlexPlayStatusScheduledTask.KEY,
    (ctx) =>
      (
        plexServer: MediaSourceWithRelations,
        request: UpdatePlexPlayStatusScheduleRequest,
        sessionId: string,
      ) =>
        new UpdatePlexPlayStatusScheduledTask(
          ctx.get<MediaSourceApiFactory>(MediaSourceApiFactory),
          plexServer,
          request,
          sessionId,
        ),
  );

  bind(SubtitleExtractorTask).toSelf();
  bindAutoFactory(
    bind,
    autoFactoryKey(SubtitleExtractorTask),
    SubtitleExtractorTask,
  );

  bind<RefreshMediaSourceLibraryTask>(RefreshMediaSourceLibraryTask).toSelf();

  bind(SyncCustomShowsTask).toSelf();
  bindAutoFactory(bind, SyncCustomShowsTask.KEY, SyncCustomShowsTask);
});

export { TasksModule };
