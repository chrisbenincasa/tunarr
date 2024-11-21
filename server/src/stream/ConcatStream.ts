import { SettingsDB, getSettings } from '@/db/SettingsDB.ts';
import { Channel } from '@/db/schema/Channel.ts';
import { FFmpegFactory } from '@/ffmpeg/FFmpegFactory.ts';
import { FfmpegTranscodeSession } from '@/ffmpeg/FfmpegTrancodeSession.ts';
import { MpegTsOutputFormat } from '@/ffmpeg/builder/constants.ts';
import { ConcatStreamModeToChildMode } from '@/ffmpeg/ffmpegBase.ts';
import { makeFfmpegPlaylistUrl, makeLocalUrl } from '@/util/serverUtil.js';
import { FfmpegSettings } from '@tunarr/types';
import { ConcatSessionType } from './Session.ts';

export class ConcatStream {
  #ffmpegSettings: FfmpegSettings;

  constructor(
    private channel: Channel,
    private streamMode: ConcatSessionType,
    settings: SettingsDB = getSettings(),
  ) {
    this.#ffmpegSettings = settings.ffmpegSettings();
  }

  createSession(): Promise<FfmpegTranscodeSession> {
    const ffmpeg = FFmpegFactory.getFFmpegPipelineBuilder(
      this.#ffmpegSettings,
      this.channel,
    );

    switch (this.streamMode) {
      // If we're wrapping an HLS stream, direct the concat process to
      // the m3u8 URL
      case 'hls_concat':
      case 'hls_slower_concat': {
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
