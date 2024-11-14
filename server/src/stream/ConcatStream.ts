import { ChannelStreamMode, FfmpegSettings } from '@tunarr/types';
import { initial } from 'lodash-es';
import { Channel } from '../dao/direct/schema/Channel.ts';
import { SettingsDB, getSettings } from '../dao/settings.ts';
import { FfmpegStreamFactory } from '../ffmpeg/FfmpegStreamFactory.ts';
import { FfmpegTranscodeSession } from '../ffmpeg/FfmpegTrancodeSession.ts';
import { ConcatOptions, FFMPEG } from '../ffmpeg/ffmpeg.ts';
import { makeFfmpegPlaylistUrl, makeLocalUrl } from '../util/serverUtil.js';

type ConcatStreamOptions = {
  parentProcessType: 'hls' | 'direct';
  audioOnly?: boolean;
};

export class ConcatStream {
  #ffmpegSettings: FfmpegSettings;

  constructor(
    private channel: Channel,
    private concatOptions?: Partial<ConcatOptions & ConcatStreamOptions>,
    settings: SettingsDB = getSettings(),
  ) {
    this.#ffmpegSettings = settings.ffmpegSettings();
  }

  createSession(): Promise<FfmpegTranscodeSession> {
    const mode = this.concatOptions?.mode ?? 'mpegts_concat';
    // TODO... this is SO hacky
    const childStreamMode = initial(mode.split('_')).join(
      '_',
    ) as ChannelStreamMode;
    let concatUrl: string;
    switch (mode) {
      // If we're wrapping an HLS stream, direct the concat process to
      // the m3u8 URL
      case 'hls_concat':
      case 'hls_slower_concat':
        concatUrl = makeLocalUrl(`/stream/channels/${this.channel.uuid}.m3u8`, {
          mode: childStreamMode,
        });
        break;
      case 'mpegts_concat':
        concatUrl = makeFfmpegPlaylistUrl({
          channel: this.channel.uuid,
          audioOnly: this.concatOptions?.audioOnly ?? false,
          mode: childStreamMode,
        });
        break;
    }

    const ffmpeg = this.#ffmpegSettings.useNewFfmpegPipeline
      ? new FfmpegStreamFactory(this.#ffmpegSettings, this.channel)
      : new FFMPEG(this.#ffmpegSettings, this.channel);
    return ffmpeg.createWrapperConcatSession(concatUrl, childStreamMode);
  }
}
