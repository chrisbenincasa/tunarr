import {
  ReadableFfmpegSettings,
  SettingsDB,
  getSettings,
} from '@/db/SettingsDB.js';
import { ChannelWithTranscodeConfig } from '@/db/schema/derivedTypes.js';
import { FFmpegFactory } from '@/ffmpeg/FFmpegFactory.js';
import { FfmpegTranscodeSession } from '@/ffmpeg/FfmpegTrancodeSession.js';
import { MpegTsOutputFormat } from '@/ffmpeg/builder/constants.js';
import { ConcatStreamModeToChildMode } from '@/ffmpeg/ffmpegBase.js';
import { makeFfmpegPlaylistUrl, makeLocalUrl } from '@/util/serverUtil.js';
import { ChannelConcatStreamMode } from '@tunarr/types/schemas';

export class ConcatStream {
  #ffmpegSettings: ReadableFfmpegSettings;

  constructor(
    private channel: ChannelWithTranscodeConfig,
    private streamMode: ChannelConcatStreamMode,
    settings: SettingsDB = getSettings(),
  ) {
    this.#ffmpegSettings = settings.ffmpegSettings();
  }

  async createSession(): Promise<FfmpegTranscodeSession> {
    const ffmpeg = FFmpegFactory.getFFmpegPipelineBuilder(
      this.#ffmpegSettings,
      this.channel.transcodeConfig,
      this.channel,
      ConcatStreamModeToChildMode[this.streamMode],
    );

    switch (this.streamMode) {
      // If we're wrapping an HLS stream, direct the concat process to
      // the m3u8 URL
      case 'hls_concat':
      case 'hls_slower_concat':
      case 'hls_direct_concat': {
        const childStreamMode = ConcatStreamModeToChildMode[this.streamMode];
        return ffmpeg.createHlsWrapperSession(
          makeLocalUrl(`/stream/channels/${this.channel.uuid}.m3u8`, {
            mode: childStreamMode,
          }),
          {
            outputFormat: MpegTsOutputFormat,
            mode: this.streamMode,
          },
        );
      }
      case 'mpegts_concat':
        return ffmpeg.createConcatSession(
          makeFfmpegPlaylistUrl({
            channel: this.channel.uuid,
            audioOnly: false, // TODO
            mode: 'mpegts',
          }),
          {
            outputFormat: MpegTsOutputFormat,
            mode: this.streamMode,
          },
        );
    }
  }
}
