import { MediaSourceDB } from '@/db/mediaSourceDB.js';
import type { OutputFormat } from '@/ffmpeg/builder/constants.js';
import { OnDemandChannelService } from '@/services/OnDemandChannelService.js';
import { CacheImageService } from '@/services/cacheImageService.js';
import type { ConcatSessionFactory } from '@/stream/ConcatSession.js';
import { ConcatSession } from '@/stream/ConcatSession.js';
import type { ConcatStreamFactory } from '@/stream/ConcatStream.js';
import { ConcatStream } from '@/stream/ConcatStream.js';
import { OfflineProgramStream } from '@/stream/OfflineProgramStream.js';
import type { PlayerContext } from '@/stream/PlayerStreamContext.js';
import type { ProgramStream } from '@/stream/ProgramStream.js';
import { SessionManager } from '@/stream/SessionManager.js';
import { StreamProgramCalculator } from '@/stream/StreamProgramCalculator.js';
import type {
  HlsSessionProvider,
  HlsSlowerSessionProvider,
} from '@/stream/hls/HlsSession.js';
import { HlsSession } from '@/stream/hls/HlsSession.js';
import { HlsSlowerSession } from '@/stream/hls/HlsSlowerSession.js';
import { JellyfinProgramStream } from '@/stream/jellyfin/JellyfinProgramStream.js';
import { JellyfinStreamDetails } from '@/stream/jellyfin/JellyfinStreamDetails.js';
import { PlexProgramStream } from '@/stream/plex/PlexProgramStream.js';
import { PlexStreamDetails } from '@/stream/plex/PlexStreamDetails.js';
import { KEYS } from '@/types/inject.js';
import type { interfaces } from 'inversify';
import { ContainerModule } from 'inversify';
import type { IProgramDB } from '../db/interfaces/IProgramDB.ts';
import type { ISettingsDB } from '../db/interfaces/ISettingsDB.ts';
import type { FFmpegFactory } from '../ffmpeg/FFmpegModule.ts';
import { FillerPicker } from '../services/FillerPicker.ts';
import type { UpdatePlexPlayStatusScheduledTaskFactory } from '../tasks/plex/UpdatePlexPlayStatusTask.ts';
import { UpdatePlexPlayStatusScheduledTask } from '../tasks/plex/UpdatePlexPlayStatusTask.ts';
import { bindFactoryFunc } from '../util/inject.ts';
import { PersistentChannelCache } from './ChannelCache.ts';
import type { ProgramStreamFactory } from './ProgramStreamFactory.ts';
import { ExternalStreamDetailsFetcherFactory } from './StreamDetailsFetcher.ts';
import { EmbyProgramStream } from './emby/EmbyProgramStream.ts';
import { EmbyStreamDetails } from './emby/EmbyStreamDetails.ts';
import { LocalProgramStream } from './local/LocalProgramStream.ts';

export type OfflineStreamFactoryType = interfaces.MultiFactory<
  ProgramStream,
  [boolean],
  [PlayerContext, OutputFormat]
>;

const configure: interfaces.ContainerModuleCallBack = (bind) => {
  bind(SessionManager).toSelf().inSingletonScope();

  bindFactoryFunc<ProgramStreamFactory>(
    bind,
    KEYS.ProgramStreamFactory,
    (ctx) => {
      return (playerContext: PlayerContext, outputFormat: OutputFormat) => {
        return new PlexProgramStream(
          ctx.container.get<ISettingsDB>(KEYS.SettingsDB),
          ctx.container.get(MediaSourceDB),
          ctx.container.get<interfaces.AutoFactory<PlexStreamDetails>>(
            KEYS.PlexStreamDetailsFactory,
          ),
          ctx.container.get(CacheImageService),
          ctx.container.get<FFmpegFactory>(KEYS.FFmpegFactory),
          ctx.container.get<UpdatePlexPlayStatusScheduledTaskFactory>(
            UpdatePlexPlayStatusScheduledTask.KEY,
          ),
          playerContext,
          outputFormat,
        );
      };
    },
  ).whenTargetNamed('plex');

  bindFactoryFunc<ProgramStreamFactory>(
    bind,
    KEYS.ProgramStreamFactory,
    (ctx) => {
      return (playerContext: PlayerContext, outputFormat: OutputFormat) => {
        return new JellyfinProgramStream(
          ctx.container.get<ISettingsDB>(KEYS.SettingsDB),
          ctx.container.get(MediaSourceDB),
          ctx.container.get<interfaces.AutoFactory<JellyfinStreamDetails>>(
            KEYS.JellyfinStreamDetailsFactory,
          ),
          ctx.container.get(CacheImageService),
          ctx.container.get<FFmpegFactory>(KEYS.FFmpegFactory),
          playerContext,
          outputFormat,
        );
      };
    },
  ).whenTargetNamed('jellyfin');

  bindFactoryFunc<ProgramStreamFactory>(
    bind,
    KEYS.ProgramStreamFactory,
    (ctx) => {
      return (playerContext: PlayerContext, outputFormat: OutputFormat) => {
        return new EmbyProgramStream(
          ctx.container.get<ISettingsDB>(KEYS.SettingsDB),
          ctx.container.get(MediaSourceDB),
          ctx.container.get<interfaces.AutoFactory<EmbyStreamDetails>>(
            KEYS.EmbyStreamDetailsFactory,
          ),
          ctx.container.get(CacheImageService),
          ctx.container.get<FFmpegFactory>(KEYS.FFmpegFactory),
          playerContext,
          outputFormat,
        );
      };
    },
  ).whenTargetNamed('emby');

  bindFactoryFunc<ProgramStreamFactory>(
    bind,
    KEYS.ProgramStreamFactory,
    (ctx) => {
      return (playerContext: PlayerContext, outputFormat: OutputFormat) => {
        return new LocalProgramStream(
          ctx.container.get<ISettingsDB>(KEYS.SettingsDB),
          ctx.container.get(CacheImageService),
          ctx.container.get<FFmpegFactory>(KEYS.FFmpegFactory),
          ctx.container.get<IProgramDB>(KEYS.ProgramDB),
          playerContext,
          outputFormat,
        );
      };
    },
  ).whenTargetNamed('local');

  bind<OfflineStreamFactoryType>(KEYS.ProgramStreamFactory)
    .toFactory<ProgramStream, [boolean], [PlayerContext, OutputFormat]>(
      (ctx) => {
        return (isError: boolean) =>
          (playerContext: PlayerContext, outputFormat: OutputFormat) => {
            return new OfflineProgramStream(
              ctx.container.get(KEYS.SettingsDB),
              ctx.container.get(CacheImageService),
              ctx.container.get<FFmpegFactory>(KEYS.FFmpegFactory),
              isError,
              playerContext,
              outputFormat,
            );
          };
      },
    )
    .whenTargetNamed('offline');

  bind<ProgramStreamFactory>(KEYS.ProgramStreamFactory)
    .toFactory<ProgramStream, [PlayerContext, OutputFormat]>((ctx) => {
      return (playerContext: PlayerContext, outputFormat: OutputFormat) => {
        switch (playerContext.lineupItem.type) {
          case 'program':
          case 'commercial': {
            return ctx.container.getNamed<ProgramStreamFactory>(
              KEYS.ProgramStreamFactory,
              playerContext.lineupItem.program.sourceType,
            )(playerContext, outputFormat);
          }
          case 'offline':
          case 'error': {
            const isError = playerContext.lineupItem.type === 'error';
            return ctx.container.getNamed<OfflineStreamFactoryType>(
              KEYS.ProgramStreamFactory,
              'offline',
            )(isError)(playerContext, outputFormat);
          }
          case 'redirect':
            throw new Error('Impossible');
        }
      };
    })
    .whenTargetIsDefault();

  bind<interfaces.Factory<HlsSession>>(KEYS.HlsSession).toFactory<
    HlsSession,
    Parameters<HlsSessionProvider>
  >((ctx) => {
    return (channel, options) => {
      return new HlsSession(
        channel,
        options,
        ctx.container.get(StreamProgramCalculator),
        ctx.container.get<ISettingsDB>(KEYS.SettingsDB),
        ctx.container.get(OnDemandChannelService),
        ctx.container.get<ProgramStreamFactory>(KEYS.ProgramStreamFactory),
      );
    };
  });

  bind<interfaces.Factory<HlsSlowerSession>>(KEYS.HlsSlowerSession).toFactory<
    HlsSlowerSession,
    Parameters<HlsSlowerSessionProvider>
  >((ctx) => {
    return (channel, options) => {
      return new HlsSlowerSession(
        channel,
        options,
        ctx.container.get(StreamProgramCalculator),
        ctx.container.get<ProgramStreamFactory>(KEYS.ProgramStreamFactory),
        ctx.container.get<FFmpegFactory>(KEYS.FFmpegFactory),
      );
    };
  });

  bind<interfaces.Factory<ConcatSession>>(KEYS.ConcatSession).toFactory<
    ConcatSession,
    Parameters<ConcatSessionFactory>
  >((ctx) => {
    const concatStreamFactory = ctx.container.get<ConcatStreamFactory>(
      KEYS.ConcatStreamFactory,
    );
    return (channel, options) => {
      return new ConcatSession(channel, options, concatStreamFactory);
    };
  });

  bind(JellyfinStreamDetails).toSelf();
  bind<interfaces.Factory<JellyfinStreamDetails>>(
    KEYS.JellyfinStreamDetailsFactory,
  ).toAutoFactory<JellyfinStreamDetails>(JellyfinStreamDetails);

  bind(PlexStreamDetails).toSelf();
  bind<interfaces.Factory<PlexStreamDetails>>(
    KEYS.PlexStreamDetailsFactory,
  ).toAutoFactory(PlexStreamDetails);

  bind(EmbyStreamDetails).toSelf();
  bind<interfaces.Factory<EmbyStreamDetails>>(
    KEYS.EmbyStreamDetailsFactory,
  ).toAutoFactory(EmbyStreamDetails);

  bind<interfaces.Factory<ConcatStream>>(KEYS.ConcatStreamFactory).toFactory<
    ConcatStream,
    Parameters<ConcatStreamFactory>
  >((ctx) => {
    const ffmpegFactory = ctx.container.get<FFmpegFactory>(KEYS.FFmpegFactory);
    return (channel, streamMode) => {
      return new ConcatStream(channel, streamMode, ffmpegFactory);
    };
  });

  bind(ExternalStreamDetailsFetcherFactory).toSelf().inSingletonScope();

  bind(PersistentChannelCache).toSelf().inSingletonScope();

  bind(KEYS.FillerPicker).to(FillerPicker).inSingletonScope();
};

class StreamModule extends ContainerModule {
  constructor() {
    super(configure);
  }
}

export { StreamModule };
