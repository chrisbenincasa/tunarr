import { OnDemandChannelService } from '@/services/OnDemandChannelService.js';
import type { ConcatSessionFactory } from '@/stream/ConcatSession.js';
import { ConcatSession } from '@/stream/ConcatSession.js';
import type { ConcatStreamFactory } from '@/stream/ConcatStream.js';
import { ConcatStream } from '@/stream/ConcatStream.js';
import { SessionManager } from '@/stream/SessionManager.js';
import { StreamProgramCalculator } from '@/stream/StreamProgramCalculator.js';
import type {
  HlsSessionProvider,
  HlsSlowerSessionProvider,
} from '@/stream/hls/HlsSession.js';
import { HlsSession } from '@/stream/hls/HlsSession.js';
import { HlsSlowerSession } from '@/stream/hls/HlsSlowerSession.js';
import { autoFactoryKey, KEYS } from '@/types/inject.js';
import type { ContainerModuleLoadOptions, Factory } from 'inversify';
import { ContainerModule } from 'inversify';
import type { ISettingsDB } from '../db/interfaces/ISettingsDB.ts';
import type { FFmpegFactory } from '../ffmpeg/FFmpegModule.ts';
import { FillerPickerV2 } from '../services/scheduling/FillerPickerV2.ts';
import { bindAssistedFactory } from '../util/assistedInject.ts';
import { bindAutoFactory } from '../util/inject.ts';
import { ProgramStreamDetailsFetcher } from './LocalProgramStreamDetails.ts';
import { ProgramStream } from './ProgramStream2.ts';
import type { ProgramStreamFactory } from './ProgramStreamFactory.ts';

const configure = ({ bind }: ContainerModuleLoadOptions) => {
  bind(SessionManager).toSelf().inSingletonScope();

  bindAssistedFactory(bind, KEYS.ProgramStreamFactory, ProgramStream);

  bind<Factory<HlsSession, Parameters<HlsSessionProvider>>>(
    KEYS.HlsSession,
  ).toFactory((ctx) => {
    return (channel, options) => {
      return new HlsSession(
        channel,
        options,
        ctx.get(StreamProgramCalculator),
        ctx.get<ISettingsDB>(KEYS.SettingsDB),
        ctx.get(OnDemandChannelService),
        ctx.get<ProgramStreamFactory>(KEYS.ProgramStreamFactory),
      );
    };
  });

  bind<Factory<HlsSlowerSession, Parameters<HlsSlowerSessionProvider>>>(
    KEYS.HlsSlowerSession,
  ).toFactory((ctx) => {
    return (channel, options) => {
      return new HlsSlowerSession(
        channel,
        options,
        ctx.get(StreamProgramCalculator),
        ctx.get<ProgramStreamFactory>(KEYS.ProgramStreamFactory),
        ctx.get<FFmpegFactory>(KEYS.FFmpegFactory),
      );
    };
  });

  bind<Factory<ConcatSession, Parameters<ConcatSessionFactory>>>(
    KEYS.ConcatSession,
  ).toFactory((ctx) => {
    const concatStreamFactory = ctx.get<ConcatStreamFactory>(
      KEYS.ConcatStreamFactory,
    );
    return (channel, options) => {
      return new ConcatSession(channel, options, concatStreamFactory);
    };
  });

  bind(ProgramStreamDetailsFetcher).toSelf();
  bindAutoFactory(
    bind,
    autoFactoryKey(ProgramStreamDetailsFetcher),
    ProgramStreamDetailsFetcher,
  );

  bind<Factory<ConcatStream, Parameters<ConcatStreamFactory>>>(
    KEYS.ConcatStreamFactory,
  ).toFactory((ctx) => {
    const ffmpegFactory = ctx.get<FFmpegFactory>(KEYS.FFmpegFactory);
    return (channel, streamMode) => {
      return new ConcatStream(channel, streamMode, ffmpegFactory);
    };
  });

  bind(KEYS.FillerPicker).to(FillerPickerV2).inSingletonScope();
};

class StreamModule extends ContainerModule {
  constructor() {
    super(configure);
  }
}

export { StreamModule };
