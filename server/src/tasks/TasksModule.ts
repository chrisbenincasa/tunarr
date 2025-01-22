import {
  ArchiveDatabaseBackup,
  ArchiveDatabaseBackupFactory,
  ArchiveDatabaseBackupKey,
} from '@/db/backup/ArchiveDatabaseBackup.js';
import { CleanupSessionsTask } from '@/tasks/CleanupSessionsTask.js';
import { OnDemandChannelStateTask } from '@/tasks/OnDemandChannelStateTask.js';
import { ReconcileProgramDurationsTask } from '@/tasks/ReconcileProgramDurationsTask.js';
import { ScheduleDynamicChannelsTask } from '@/tasks/ScheduleDynamicChannelsTask.js';
import { UpdateXmlTvTask } from '@/tasks/UpdateXmlTvTask.js';
import { KEYS } from '@/types/inject.js';
import { ContainerModule, interfaces } from 'inversify';
import { bindFactoryFunc } from '../util/inject.ts';
import { BackupTask, BackupTaskFactory } from './BackupTask.ts';

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
        channelId,
      ),
  );

  bindFactoryFunc<ArchiveDatabaseBackupFactory>(
    bind,
    ArchiveDatabaseBackupKey,
    (ctx) =>
      (...args: Parameters<ArchiveDatabaseBackupFactory>) =>
        new ArchiveDatabaseBackup(ctx.container.get(KEYS.SettingsDB), ...args),
  );

  bindFactoryFunc<BackupTaskFactory>(
    bind,
    BackupTask.KEY,
    (ctx) => (conf) => () =>
      new BackupTask(conf, ctx.container.get(ArchiveDatabaseBackupKey)),
  );
});

export { TasksModule };
