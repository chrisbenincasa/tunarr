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
import type { interfaces } from 'inversify';
import { Container, ContainerModule } from 'inversify';
import type { DeepPartial } from 'ts-essentials';
import { SettingsDBFactory } from './db/SettingsDBFactory.ts';
import { MediaSourceApiFactory } from './external/MediaSourceApiFactory.ts';
import { FfmpegPipelineBuilderModule } from './ffmpeg/builder/pipeline/PipelineBuilderFactory.ts';
import { SystemDevicesService } from './services/SystemDevicesService.ts';
import { DynamicChannelsModule } from './services/dynamic_channels/DynamicChannelsModule.ts';
import { Timer } from './util/Timer.ts';

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

  bind(TVGuideService).toSelf().inSingletonScope();
  bind(EventService).toSelf().inSingletonScope();
  bind(HdhrService).toSelf().inSingletonScope();
  bind(SystemDevicesService).toSelf().inSingletonScope();
});

container.load(RootModule);
container.load(dbContainer);
container.load(StreamModule);
container.load(TasksModule);
container.load(HealthCheckModule);
container.load(FixerModule);
container.load(FFmpegModule);
container.load(FfmpegPipelineBuilderModule);
container.load(DynamicChannelsModule);

export { container };
