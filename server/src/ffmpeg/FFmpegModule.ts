import type { ISettingsDB } from '@/db/interfaces/ISettingsDB.js';
import type { Channel } from '@/db/schema/Channel.js';
import type { TranscodeConfig } from '@/db/schema/TranscodeConfig.js';
import { FfmpegStreamFactory } from '@/ffmpeg/FfmpegStreamFactory.js';
import type { IFFMPEG } from '@/ffmpeg/ffmpegBase.js';
import { KEYS } from '@/types/inject.js';
import type { ChannelStreamMode } from '@tunarr/types';
import { ContainerModule } from 'inversify';
import type { IChannelDB } from '../db/interfaces/IChannelDB.ts';
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
        ctx.container.get<IChannelDB>(KEYS.ChannelDB),
      );
    };
  }).whenTargetNamed(FfmpegStreamFactory.name);

  bindFactoryFunc<FFmpegFactory>(bind, KEYS.FFmpegFactory, (ctx) => {
    return (transcodeConfig, channel, streamMode) => {
      return ctx.container.getNamed<FFmpegFactory>(
        KEYS.FFmpegFactory,
        FfmpegStreamFactory.name,
      )(transcodeConfig, channel, streamMode);
    };
  }).whenTargetIsDefault();
});

export { FFmpegModule };
