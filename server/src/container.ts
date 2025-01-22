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
import { Container } from 'inversify';
import type { DeepPartial } from 'ts-essentials';
import { SettingsDBFactory } from './db/SettingsDBFactory.ts';
import { FfmpegPipelineBuilderModule } from './ffmpeg/builder/pipeline/PipelineBuilderFactory.ts';
import { DynamicChannelsModule } from './services/dynamic_channels/DynamicChannelsModule.ts';
import { Timer } from './util/Timer.ts';

const container = new Container({ autoBindInjectable: true });

container
  .bind<GlobalOptions>(KEYS.GlobalOptions)
  .toDynamicValue(() => globalOptions());
container
  .bind<ServerOptions>(KEYS.ServerOptions)
  .toDynamicValue(() => serverOptions());

container.bind<ITimer>(KEYS.Timer).to(Timer);

container.bind(SettingsDBFactory).toSelf().inSingletonScope();

container
  .bind<interfaces.Factory<ISettingsDB>>('Factory<ISettingsDB>')
  .toFactory<
    SettingsDB,
    [string | undefined, DeepPartial<SettingsFile> | undefined]
  >((context) => {
    const inst = context.container.get(SettingsDBFactory);
    return (dbPath, initialSettings) => inst.get(dbPath, initialSettings);
  });

container.bind<ISettingsDB>(KEYS.SettingsDB).toDynamicValue((ctx) => {
  return ctx.container.get<() => ISettingsDB>('Factory<ISettingsDB>')();
});

container
  .bind<typeof LoggerFactory>(KEYS.LoggerFactory)
  .toConstantValue(LoggerFactory);

container.bind<Logger>(KEYS.Logger).toDynamicValue((ctx) => {
  const impl =
    ctx.currentRequest.parentRequest?.bindings?.[0]?.implementationType;
  return LoggerFactory.child({
    className: impl ? (Reflect.get(impl, 'name') as string) : 'Unknown',
  });
});

container.bind(ServerContext).toSelf().inSingletonScope();

container.bind<MutexMap>(KEYS.MutexMap).toDynamicValue(() => new MutexMap());

container
  .bind<interfaces.Factory<MutexMap>>('Factory<MutexMax>')
  .toFactory<MutexMap, [Maybe<number>]>(
    () => (timeout?: number) => new MutexMap(timeout),
  );

container.bind(TVGuideService).toSelf().inSingletonScope();
container.bind(EventService).toSelf().inSingletonScope();
container.bind(HdhrService).toSelf().inSingletonScope();

container.load(dbContainer);
container.load(StreamModule);
container.load(TasksModule);
container.load(HealthCheckModule);
container.load(FixerModule);
container.load(FFmpegModule);
container.load(FfmpegPipelineBuilderModule);
container.load(DynamicChannelsModule);

export { container };
