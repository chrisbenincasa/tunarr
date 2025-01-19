import { ReadableFfmpegSettings } from '@/db/SettingsDB.js';
import { Channel } from '@/db/schema/Channel.js';
import { TranscodeConfig } from '@/db/schema/TranscodeConfig.js';
import { ChannelStreamMode, ChannelStreamModes } from '@tunarr/types';
import { FfmpegStreamFactory } from './FfmpegStreamFactory.ts';
import { FFMPEG } from './ffmpeg.ts';
import { IFFMPEG } from './ffmpegBase.ts';

export class FFmpegFactory {
  static getFFmpegPipelineBuilder(
    settings: ReadableFfmpegSettings,
    transcodeConfig: TranscodeConfig,
    channel: Channel,
    streamMode: ChannelStreamMode,
  ): IFFMPEG {
    if (
      settings.useNewFfmpegPipeline ||
      streamMode === ChannelStreamModes.HlsDirect
    ) {
      return new FfmpegStreamFactory(settings, transcodeConfig, channel);
    } else {
      return new FFMPEG(settings, transcodeConfig, channel);
    }
  }
}
