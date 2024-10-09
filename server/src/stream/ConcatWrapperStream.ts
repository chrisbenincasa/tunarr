import { ChannelStreamMode, FfmpegSettings } from '@tunarr/types';
import { StrictExtract } from 'ts-essentials';
import { Channel } from '../dao/direct/schema/Channel';
import { SettingsDB, getSettings } from '../dao/settings.js';
import { FfmpegTranscodeSession } from '../ffmpeg/FfmpegTrancodeSession.js';
import { ConcatOptions, FFMPEG } from '../ffmpeg/ffmpeg.js';
import { makeLocalUrl } from '../util/serverUtil.js';

type ConcatStreamOptions = {
  childStreamMode: StrictExtract<ChannelStreamMode, 'hls' | 'hls_slower'>;
};

export class ConcatWrapperStream {
  #ffmpegSettings: FfmpegSettings;

  constructor(
    private channel: Channel,
    private concatOptions: ConcatStreamOptions & Partial<ConcatOptions>,
    settings: SettingsDB = getSettings(),
  ) {
    this.#ffmpegSettings = settings.ffmpegSettings();
  }

  createSession(): FfmpegTranscodeSession {
    // const mode = this.concatOptions?.mode ?? 'mpegts_concat';
    const concatUrl = makeLocalUrl(
      `/stream/channels/${this.channel.uuid}.m3u8`,
      {
        mode: this.concatOptions.childStreamMode,
      },
    );

    return new FFMPEG(
      this.#ffmpegSettings,
      this.channel,
    ).createWrapperConcatSession(concatUrl, this.concatOptions.childStreamMode);
  }
}
