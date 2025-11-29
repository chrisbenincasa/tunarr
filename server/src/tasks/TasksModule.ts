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
import { KEYS } from '@/types/inject.js';
import type { interfaces } from 'inversify';
import { ContainerModule } from 'inversify';
import type { IChannelDB } from '../db/interfaces/IChannelDB.ts';
import { type IProgramDB } from '../db/interfaces/IProgramDB.ts';
import type { ISettingsDB } from '../db/interfaces/ISettingsDB.ts';
import { MediaSourceDB } from '../db/mediaSourceDB.ts';
import type { MediaSourceWithRelations } from '../db/schema/derivedTypes.js';
import { MediaSourceApiFactory } from '../external/MediaSourceApiFactory.ts';
import type { GlobalOptions } from '../globals.ts';
import { TVGuideService } from '../services/TvGuideService.ts';
import { ExternalStreamDetailsFetcherFactory } from '../stream/StreamDetailsFetcher.ts';
import type { Maybe } from '../types/util.ts';
import { bindFactoryFunc } from '../util/inject.ts';
import type { LoggerFactory } from '../util/logging/LoggerFactory.ts';
import type { BackupTaskFactory } from './BackupTask.ts';
import { BackupTask } from './BackupTask.ts';
import { SaveJellyfinProgramExternalIdsTask } from './jellyfin/SaveJellyfinProgramExternalIdsTask.ts';
import type { SavePlexProgramExternalIdsTaskFactory } from './plex/SavePlexProgramExternalIdsTask.ts';
import { SavePlexProgramExternalIdsTask } from './plex/SavePlexProgramExternalIdsTask.ts';
import type {
  UpdatePlexPlayStatusScheduledTaskFactory,
  UpdatePlexPlayStatusScheduleRequest,
} from './plex/UpdatePlexPlayStatusTask.ts';
import { UpdatePlexPlayStatusScheduledTask } from './plex/UpdatePlexPlayStatusTask.ts';
import { RefreshMediaSourceLibraryTask } from './RefreshMediaSourceLibraryTask.ts';
import { RemoveDanglingProgramsFromSearchTask } from './RemoveDanglingProgramsFromSearchTask.ts';
import { ScanLibrariesTask } from './ScanLibrariesTask.ts';
import type {
  SubtitleExtractorTaskFactory,
  SubtitleExtractorTaskRequest,
} from './SubtitleExtractorTask.ts';
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

  bind<
    interfaces.Factory<
      ReconcileProgramDurationsTask,
      [Maybe<ReconcileProgramDurationsTaskRequest>]
    >
  >(ReconcileProgramDurationsTask.KEY).toFactory(
    (ctx) => (request?: ReconcileProgramDurationsTaskRequest) =>
      new ReconcileProgramDurationsTask(
        ctx.container.get(KEYS.ChannelDB),
        ctx.container.get(KEYS.Logger),
        ctx.container.get(KEYS.Database),
        request,
      ),
  );

  bind<SavePlexProgramExternalIdsTaskFactory>(
    SavePlexProgramExternalIdsTask.KEY,
  ).toFactory((ctx) => {
    return (programId: string) => {
      return new SavePlexProgramExternalIdsTask(
        programId,
        ctx.container.get<IProgramDB>(KEYS.ProgramDB),
        ctx.container.get(MediaSourceApiFactory),
      );
    };
  });

  bind<interfaces.Factory<SaveJellyfinProgramExternalIdsTask>>(
    SaveJellyfinProgramExternalIdsTask.KEY,
  ).toFactory((ctx) => {
    return (programId: string) =>
      new SaveJellyfinProgramExternalIdsTask(
        programId,
        ctx.container.get<IProgramDB>(KEYS.ProgramDB),
        ctx.container.get(MediaSourceApiFactory),
      );
  });

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

  bindFactoryFunc<SubtitleExtractorTaskFactory>(
    bind,
    SubtitleExtractorTask.KEY,
    (ctx) => (req: SubtitleExtractorTaskRequest) =>
      new SubtitleExtractorTask(
        ctx.container
          .get<typeof LoggerFactory>(KEYS.LoggerFactory)
          .child({ className: SubtitleExtractorTask.name }),
        ctx.container.get<TVGuideService>(TVGuideService),
        ctx.container.get<IChannelDB>(KEYS.ChannelDB),
        ctx.container.get<ExternalStreamDetailsFetcherFactory>(
          ExternalStreamDetailsFetcherFactory,
        ),
        ctx.container.get<MediaSourceDB>(MediaSourceDB),
        ctx.container.get<ISettingsDB>(KEYS.SettingsDB),
        ctx.container.get<GlobalOptions>(KEYS.GlobalOptions),
        ctx.container.get<IProgramDB>(KEYS.ProgramDB),
        req,
      ),
  );

  bind<RefreshMediaSourceLibraryTask>(RefreshMediaSourceLibraryTask).toSelf();
});

export { TasksModule };
