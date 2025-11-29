import { ServerContext } from '@/ServerContext.js';
import { dbContainer } from '@/db/DBModule.js';
import type { SettingsDB, SettingsFile } from '@/db/SettingsDB.js';
import type { ISettingsDB } from '@/db/interfaces/ISettingsDB.js';
import { FFmpegModule } from '@/ffmpeg/FFmpegModule.js';
import {
  type GlobalOptions,
  type ServerOptions,
  globalOptions,
  serverOptions,
} from '@/globals.js';
import type { ITimer } from '@/interfaces/ITimer.js';
import { EventService } from '@/services/EventService.js';
import { HdhrService } from '@/services/HDHRService.js';
import { TVGuideService } from '@/services/TvGuideService.js';
import { HealthCheckModule } from '@/services/health_checks/HealthCheckModule.js';
import { StreamModule } from '@/stream/StreamModule.js';
import { TasksModule } from '@/tasks/TasksModule.js';
import { FixerModule } from '@/tasks/fixers/FixerModule.js';
import { KEYS } from '@/types/inject.js';
import type { Maybe } from '@/types/util.js';
import type { Logger } from '@/util/logging/LoggerFactory.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import { MutexMap } from '@/util/mutexMap.js';
import { search } from '@tunarr/shared/util';
import type { interfaces } from 'inversify';
import { Container, ContainerModule } from 'inversify';
import { isMainThread } from 'node:worker_threads';
import type { DeepPartial } from 'ts-essentials';
import { App } from './App.ts';
import { SettingsDBFactory } from './db/SettingsDBFactory.ts';
import { ExternalApiModule } from './external/ExternalApiModule.ts';
import { MediaSourceApiFactory } from './external/MediaSourceApiFactory.ts';
import { FfmpegPipelineBuilderModule } from './ffmpeg/builder/pipeline/PipelineBuilderFactory.ts';
import type { IWorkerPool } from './interfaces/IWorkerPool.ts';
import { EntityMutex } from './services/EntityMutex.ts';
import { FileSystemService } from './services/FileSystemService.ts';
import { MediaSourceLibraryRefresher } from './services/MediaSourceLibraryRefresher.js';
import { MeilisearchService } from './services/MeilisearchService.ts';
import { NoopWorkerPool } from './services/NoopWorkerPool.ts';
import { ServicesModule } from './services/ServicesModule.ts';
import { StartupService } from './services/StartupService.ts';
import { SystemDevicesService } from './services/SystemDevicesService.ts';
import { TunarrWorkerPool } from './services/TunarrWorkerPool.ts';
import { DynamicChannelsModule } from './services/dynamic_channels/DynamicChannelsModule.ts';
import { TimeSlotSchedulerService } from './services/scheduling/TimeSlotSchedulerService.ts';
import { ChannelLineupMigratorStartupTask } from './services/startup/ChannelLineupMigratorStartupTask.ts';
import { ClearM3uCacheStartupTask } from './services/startup/ClearM3uCacheStartupTask.ts';
import { GenerateGuideStartupTask } from './services/startup/GenerateGuideStartupTask.ts';
import { LoadChannelCacheStartupTask } from './services/startup/LoadChannelCacheStartupTask.ts';
import { RefreshLibrariesStartupTask } from './services/startup/RefreshLibrariesStartupTask.ts';
import { ScheduleJobsStartupTask } from './services/startup/ScheduleJobsStartupTask.ts';
import { SeedFfmpegInfoCache } from './services/startup/SeedFfmpegInfoCache.ts';
import { SeedSystemDevicesStartupTask } from './services/startup/SeedSystemDevicesStartupTask.ts';
import { StreamCacheMigratorStartupTask } from './services/startup/StreamCacheMigratorStartupTask.ts';
import { ChannelCache } from './stream/ChannelCache.ts';
import { FixerRunner } from './tasks/fixers/FixerRunner.ts';
import { ChildProcessHelper } from './util/ChildProcessHelper.ts';
import { Timer } from './util/Timer.ts';
import { getBooleanEnvVar, USE_WORKER_POOL_ENV_VAR } from './util/env.ts';

const container = new Container({ autoBindInjectable: true });

const RootModule = new ContainerModule((bind) => {
  bind<GlobalOptions>(KEYS.GlobalOptions).toDynamicValue(() => globalOptions());
  bind<ServerOptions>(KEYS.ServerOptions).toDynamicValue(() => serverOptions());

  bind<ITimer>(KEYS.Timer).to(Timer);

  bind(SettingsDBFactory).toSelf().inSingletonScope();

  bind<interfaces.Factory<ISettingsDB>>('Factory<ISettingsDB>').toFactory<
    SettingsDB,
    [string | undefined, DeepPartial<SettingsFile> | undefined]
  >((context) => {
    const inst = context.container.get(SettingsDBFactory);
    return (dbPath, initialSettings) => inst.get(dbPath, initialSettings);
  });

  bind<ISettingsDB>(KEYS.SettingsDB).toDynamicValue((ctx) => {
    return ctx.container.get<() => ISettingsDB>('Factory<ISettingsDB>')();
  });

  bind<typeof LoggerFactory>(KEYS.LoggerFactory).toConstantValue(LoggerFactory);

  bind<Logger>(KEYS.Logger).toDynamicValue((ctx) => {
    const impl =
      ctx.currentRequest.parentRequest?.bindings?.[0]?.implementationType;
    return LoggerFactory.child({
      className: impl ? (Reflect.get(impl, 'name') as string) : 'Unknown',
      worker: isMainThread ? undefined : true,
    });
  });

  bind(ServerContext).toSelf().inSingletonScope();

  bind<MutexMap>(KEYS.MutexMap).toDynamicValue(() => new MutexMap());

  bind<interfaces.Factory<MutexMap>>('Factory<MutexMax>').toFactory<
    MutexMap,
    [Maybe<number>]
  >(() => (timeout?: number) => new MutexMap(timeout));

  container.bind(MediaSourceApiFactory).toSelf().inSingletonScope();

  // If we need lazy init...
  // container
  //   .bind<MediaSourceApiFactory>(KEYS.MediaSourceApiFactory)
  //   .to(MediaSourceApiFactory)
  //   .inSingletonScope();

  container
    .bind<interfaces.Factory<MediaSourceApiFactory>>(KEYS.MediaSourceApiFactory)
    .toFactory(
      (ctx) => () =>
        ctx.container.get<MediaSourceApiFactory>(MediaSourceApiFactory),
    );

  bind(FixerRunner).toSelf().inSingletonScope();
  bind(StartupService).toSelf().inSingletonScope();
  container
    .bind<
      interfaces.Factory<MediaSourceLibraryRefresher>
    >(KEYS.MediaSourceLibraryRefresher)
    .toAutoFactory(MediaSourceLibraryRefresher);

  bind(TVGuideService).toSelf().inSingletonScope();
  bind(EventService).toSelf().inSingletonScope();
  bind(HdhrService).toSelf().inSingletonScope();
  bind(SystemDevicesService).toSelf().inSingletonScope();
  bind(FileSystemService).toSelf().inSingletonScope();
  bind(TunarrWorkerPool).toSelf().inSingletonScope();
  bind<interfaces.AutoFactory<TimeSlotSchedulerService>>(
    KEYS.TimeSlotSchedulerServiceFactory,
  ).toAutoFactory(TimeSlotSchedulerService);
  bind(KEYS.ChannelCache).to(ChannelCache).inSingletonScope();

  bind(KEYS.StartupTask).to(SeedSystemDevicesStartupTask).inSingletonScope();
  bind(KEYS.StartupTask).to(ClearM3uCacheStartupTask).inSingletonScope();
  bind(KEYS.StartupTask)
    .to(ChannelLineupMigratorStartupTask)
    .inSingletonScope();
  bind(KEYS.StartupTask).to(SeedFfmpegInfoCache).inSingletonScope();
  bind(KEYS.StartupTask).to(ScheduleJobsStartupTask).inSingletonScope();
  bind(KEYS.StartupTask).to(FixerRunner).inSingletonScope();
  bind(KEYS.StartupTask).to(GenerateGuideStartupTask).inSingletonScope();
  bind(KEYS.StartupTask).to(LoadChannelCacheStartupTask).inSingletonScope();
  bind(KEYS.StartupTask).to(StreamCacheMigratorStartupTask).inSingletonScope();
  bind(KEYS.StartupTask).to(RefreshLibrariesStartupTask).inSingletonScope();

  if (getBooleanEnvVar(USE_WORKER_POOL_ENV_VAR, false)) {
    bind(KEYS.WorkerPool).toService(TunarrWorkerPool);
  } else {
    bind(KEYS.WorkerPool).to(NoopWorkerPool).inSingletonScope();
  }

  bind<interfaces.AutoFactory<IWorkerPool>>(
    KEYS.WorkerPoolFactory,
  ).toAutoFactory(KEYS.WorkerPool);
  bind(EntityMutex).toSelf().inSingletonScope();
  bind(MeilisearchService).toSelf().inSingletonScope();
  bind(KEYS.SearchService).toService(MeilisearchService);

  bind(ChildProcessHelper).toSelf().inSingletonScope();

  bind(App).toSelf().inSingletonScope();

  bind(search.SearchParser).to(search.SearchParser);
});

container.load(RootModule);
container.load(dbContainer);
container.load(new StreamModule());
container.load(TasksModule);
container.load(HealthCheckModule);
container.load(FixerModule);
container.load(FFmpegModule);
container.load(FfmpegPipelineBuilderModule);
container.load(DynamicChannelsModule);
container.load(ServicesModule);
container.load(ExternalApiModule);

export { container };
