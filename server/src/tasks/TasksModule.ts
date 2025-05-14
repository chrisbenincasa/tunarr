import type { ArchiveDatabaseBackupFactory } from '@/db/backup/ArchiveDatabaseBackup.js';
import {
  ArchiveDatabaseBackup,
  ArchiveDatabaseBackupKey,
} from '@/db/backup/ArchiveDatabaseBackup.js';
import { CleanupSessionsTask } from '@/tasks/CleanupSessionsTask.js';
import { OnDemandChannelStateTask } from '@/tasks/OnDemandChannelStateTask.js';
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
import type { MediaSource } from '../db/schema/MediaSource.js';
import { MediaSourceApiFactory } from '../external/MediaSourceApiFactory.ts';
import type { GlobalOptions } from '../globals.ts';
import { TVGuideService } from '../services/TvGuideService.ts';
import { ExternalStreamDetailsFetcherFactory } from '../stream/StreamDetailsFetcher.ts';
import { bindFactoryFunc } from '../util/inject.ts';
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
import type {
  SubtitleExtractorTaskFactory,
  SubtitleExtractorTaskRequest,
} from './SubtitleExtractorTask.ts';
import { SubtitleExtractorTask } from './SubtitleExtractorTask.ts';

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

  bind<interfaces.Factory<ReconcileProgramDurationsTask>>(
    ReconcileProgramDurationsTask.KEY,
  ).toFactory(
    (ctx) => (channelId?: string) =>
      new ReconcileProgramDurationsTask(
        ctx.container.get(KEYS.ChannelDB),
        ctx.container.get(KEYS.Logger),
        ctx.container.get(KEYS.Database),
        channelId,
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
        plexServer: MediaSource,
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
        ctx.container.get(KEYS.Logger),
        ctx.container.get<TVGuideService>(TVGuideService),
        ctx.container.get<IChannelDB>(KEYS.ChannelDB),
        ctx.container.get<ExternalStreamDetailsFetcherFactory>(
          ExternalStreamDetailsFetcherFactory,
        ),
        ctx.container.get<MediaSourceDB>(MediaSourceDB),
        ctx.container.get<ISettingsDB>(KEYS.SettingsDB),
        ctx.container.get<GlobalOptions>(KEYS.GlobalOptions),
        req,
      ),
  );
});

export { TasksModule };
