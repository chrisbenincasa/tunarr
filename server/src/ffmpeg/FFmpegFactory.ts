import { Channel } from '@/db/schema/Channel.ts';
import { FfmpegSettings } from '@tunarr/types';
import { FfmpegStreamFactory } from './FfmpegStreamFactory.ts';
import { FFMPEG } from './ffmpeg.ts';
import { IFFMPEG } from './ffmpegBase.ts';

export class FFmpegFactory {
  static getFFmpegPipelineBuilder(
    settings: FfmpegSettings,
    channel: Channel,
  ): IFFMPEG {
    if (settings.useNewFfmpegPipeline) {
      return new FfmpegStreamFactory(settings, channel);
    } else {
      return new FFMPEG(settings, channel);
    }
  }
}
