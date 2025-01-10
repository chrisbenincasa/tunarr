import { MediaSourceDB } from '@/db/mediaSourceDB.js';
import { OutputFormat } from '@/ffmpeg/builder/constants.js';
import { OnDemandChannelService } from '@/services/OnDemandChannelService.js';
import { CacheImageService } from '@/services/cacheImageService.js';
import { ConcatSession, ConcatSessionFactory } from '@/stream/ConcatSession.js';
import { ConcatStream, ConcatStreamFactory } from '@/stream/ConcatStream.js';
import { OfflineProgramStream } from '@/stream/OfflineProgramStream.js';
import { PlayerContext } from '@/stream/PlayerStreamContext.js';
import { ProgramStream } from '@/stream/ProgramStream.js';
import { SessionManager } from '@/stream/SessionManager.js';
import { StreamProgramCalculator } from '@/stream/StreamProgramCalculator.js';
import {
  HlsSession,
  HlsSessionProvider,
  HlsSlowerSessionProvider,
} from '@/stream/hls/HlsSession.js';
import { HlsSlowerSession } from '@/stream/hls/HlsSlowerSession.js';
import { JellyfinProgramStream } from '@/stream/jellyfin/JellyfinProgramStream.js';
import { JellyfinStreamDetails } from '@/stream/jellyfin/JellyfinStreamDetails.js';
import { PlexProgramStream } from '@/stream/plex/PlexProgramStream.js';
import { PlexStreamDetails } from '@/stream/plex/PlexStreamDetails.js';
import { KEYS } from '@/types/inject.js';
import { ContainerModule, interfaces } from 'inversify';
import { ISettingsDB } from '../db/interfaces/ISettingsDB.ts';
import { FFmpegFactory } from '../ffmpeg/FFmpegModule.ts';
import { bindFactoryFunc } from '../util/inject.ts';

export type ProgramStreamFactoryType = (
  playerContext: PlayerContext,
  outputFormat: OutputFormat,
) => ProgramStream;

export type OfflineStreamFactoryType = interfaces.MultiFactory<
  ProgramStream,
  [boolean],
  [PlayerContext, OutputFormat]
>;

const StreamModule = new ContainerModule((bind) => {
  bind(SessionManager).toSelf().inSingletonScope();

  bindFactoryFunc<ProgramStreamFactoryType>(
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
          playerContext,
          outputFormat,
        );
      };
    },
  ).whenTargetNamed('plex');

  bindFactoryFunc<ProgramStreamFactoryType>(
    bind,
    KEYS.PipelineBuilderFactory,
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

  bind<ProgramStreamFactoryType>(KEYS.ProgramStreamFactory)
    .toFactory<ProgramStream, [PlayerContext, OutputFormat]>((ctx) => {
      return (playerContext: PlayerContext, outputFormat: OutputFormat) => {
        switch (playerContext.lineupItem.type) {
          case 'program':
          case 'commercial': {
            return ctx.container.getNamed<ProgramStreamFactoryType>(
              KEYS.ProgramStreamFactory,
              playerContext.lineupItem.externalSource,
            )(playerContext, outputFormat);
          }
          case 'loading':
          case 'offline':
          case 'error': {
            // const isLoading = playerContext.lineupItem.type === 'loading';
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
        ctx.container.get<ProgramStreamFactoryType>(KEYS.ProgramStreamFactory),
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
        ctx.container.get<ISettingsDB>(KEYS.SettingsDB),
        ctx.container.get<ProgramStreamFactoryType>(KEYS.ProgramStreamFactory),
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

  bind<interfaces.Factory<ConcatStream>>(KEYS.ConcatStreamFactory).toFactory<
    ConcatStream,
    Parameters<ConcatStreamFactory>
  >((ctx) => {
    const ffmpegFactory = ctx.container.get<FFmpegFactory>(KEYS.FFmpegFactory);
    return (channel, streamMode) => {
      return new ConcatStream(channel, streamMode, ffmpegFactory);
    };
  });
});

export { StreamModule };
