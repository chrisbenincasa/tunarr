import { ChannelStreamMode, FfmpegSettings } from '@tunarr/types';
import { StrictExtract } from 'ts-essentials';
import { SettingsDB, getSettings } from '../db/SettingsDB.ts';
import { Channel } from '../db/schema/Channel.ts';
import { FfmpegStreamFactory } from '../ffmpeg/FfmpegStreamFactory.ts';
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

  createSession(): Promise<FfmpegTranscodeSession> {
    const concatUrl = makeLocalUrl(
      `/stream/channels/${this.channel.uuid}.m3u8`,
      {
        mode: this.concatOptions.childStreamMode,
      },
    );

    const ffmpeg = this.#ffmpegSettings.useNewFfmpegPipeline
      ? new FfmpegStreamFactory(this.#ffmpegSettings, this.channel)
      : new FFMPEG(this.#ffmpegSettings, this.channel);

    return ffmpeg.createWrapperConcatSession(
      concatUrl,
      this.concatOptions.childStreamMode,
    );
  }
}
