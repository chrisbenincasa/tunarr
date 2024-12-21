import { Channel } from '@/db/schema/Channel.ts';
import { TranscodeConfig } from '@/db/schema/TranscodeConfig.ts';
import {
  ChannelStreamMode,
  ChannelStreamModes,
  FfmpegSettings,
} from '@tunarr/types';
import { FfmpegStreamFactory } from './FfmpegStreamFactory.ts';
import { FFMPEG } from './ffmpeg.ts';
import { IFFMPEG } from './ffmpegBase.ts';

export class FFmpegFactory {
  static getFFmpegPipelineBuilder(
    settings: FfmpegSettings,
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
