import type { ISettingsDB } from '@/db/interfaces/ISettingsDB.js';
import type { Channel } from '@/db/schema/Channel.js';
import type { TranscodeConfig } from '@/db/schema/TranscodeConfig.js';
import { FfmpegStreamFactory } from '@/ffmpeg/FfmpegStreamFactory.js';
import { FFMPEG } from '@/ffmpeg/ffmpeg.js';
import type { IFFMPEG } from '@/ffmpeg/ffmpegBase.js';
import { KEYS } from '@/types/inject.js';
import type { ChannelStreamMode } from '@tunarr/types';
import { ChannelStreamModes } from '@tunarr/types';
import { ContainerModule } from 'inversify';
import { bindFactoryFunc } from '../util/inject.ts';
import type { PipelineBuilderFactory } from './builder/pipeline/PipelineBuilderFactory.ts';
import { FfmpegInfo } from './ffmpegInfo.ts';

export type FFmpegFactory = (
  transcodeConfig: TranscodeConfig,
  channel: Channel,
  streamMode: ChannelStreamMode,
) => IFFMPEG;

const FFmpegModule = new ContainerModule((bind) => {
  bindFactoryFunc<FFmpegFactory>(bind, KEYS.FFmpegFactory, (ctx) => {
    const settingsDB = ctx.container.get<ISettingsDB>(KEYS.SettingsDB);
    return (transcodeConfig, channel) => {
      return new FfmpegStreamFactory(
        settingsDB.ffmpegSettings(),
        transcodeConfig,
        channel,
        ctx.container.get(FfmpegInfo),
        settingsDB,
        ctx.container.get<PipelineBuilderFactory>(KEYS.PipelineBuilderFactory),
      );
    };
  }).whenTargetNamed(FfmpegStreamFactory.name);

  bindFactoryFunc<FFmpegFactory>(bind, KEYS.FFmpegFactory, (ctx) => {
    const settingsDB = ctx.container.get<ISettingsDB>(KEYS.SettingsDB);
    return (transcodeConfig, channel, streamMode) => {
      const ffmpegSettings = settingsDB.ffmpegSettings();
      if (
        ffmpegSettings.useNewFfmpegPipeline ||
        streamMode === ChannelStreamModes.HlsDirect
      ) {
        return ctx.container.getNamed<FFmpegFactory>(
          KEYS.FFmpegFactory,
          FfmpegStreamFactory.name,
        )(transcodeConfig, channel, streamMode);
      } else {
        return new FFMPEG(
          settingsDB,
          ctx.container.get(FfmpegInfo),
          transcodeConfig,
          channel,
        );
      }
    };
  }).whenTargetIsDefault();
});

export { FFmpegModule };
