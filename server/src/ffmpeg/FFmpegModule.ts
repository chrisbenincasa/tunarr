import type { ISettingsDB } from '@/db/interfaces/ISettingsDB.js';
import type { TranscodeConfigOrm } from '@/db/schema/TranscodeConfig.js';
import { FfmpegStreamFactory } from '@/ffmpeg/FfmpegStreamFactory.js';
import type { IFFMPEG } from '@/ffmpeg/ffmpegBase.js';
import { KEYS } from '@/types/inject.js';
import type { ChannelStreamMode } from '@tunarr/types';
import { ContainerModule } from 'inversify';
import type { IChannelDB } from '../db/interfaces/IChannelDB.ts';
import type { ChannelOrm } from '../db/schema/Channel.ts';
import { FeatureFlagService } from '../services/FeatureFlagService.ts';
import type { PipelineBuilderFactory } from './builder/pipeline/PipelineBuilderFactory.ts';
import { FfmpegInfo } from './ffmpegInfo.ts';

export type FFmpegFactory = (
  transcodeConfig: TranscodeConfigOrm,
  channel: ChannelOrm,
  streamMode: ChannelStreamMode,
) => IFFMPEG;

const FFmpegModule = new ContainerModule(({ bind }) => {
  bind<FFmpegFactory>(KEYS.FFmpegFactory)
    .toFactory((ctx) => {
      const settingsDB = ctx.get<ISettingsDB>(KEYS.SettingsDB);
      const featureFlagService = ctx.get(FeatureFlagService);
      return (transcodeConfig, channel) => {
        return new FfmpegStreamFactory(
          settingsDB.ffmpegSettings(),
          transcodeConfig,
          channel,
          ctx.get(FfmpegInfo),
          settingsDB,
          ctx.get<PipelineBuilderFactory>(KEYS.PipelineBuilderFactory),
          ctx.get<IChannelDB>(KEYS.ChannelDB),
          featureFlagService,
        );
      };
    })
    .whenNamed(FfmpegStreamFactory.name);

  bind<FFmpegFactory>(KEYS.FFmpegFactory)
    .toFactory((ctx) => {
      return (transcodeConfig, channel, streamMode) => {
        return ctx.get<FFmpegFactory>(KEYS.FFmpegFactory, {
          name: FfmpegStreamFactory.name,
        })(transcodeConfig, channel, streamMode);
      };
    })
    .whenDefault();

  bind(FfmpegInfo).toSelf().inSingletonScope();
});

export { FFmpegModule };
