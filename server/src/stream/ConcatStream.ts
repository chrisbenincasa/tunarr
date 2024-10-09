import { ChannelStreamMode, FfmpegSettings } from '@tunarr/types';
import { initial } from 'lodash-es';
import { Channel } from '../dao/direct/schema/Channel';
import { SettingsDB, getSettings } from '../dao/settings';
import { FfmpegTranscodeSession } from '../ffmpeg/FfmpegTrancodeSession';
import { ConcatOptions, FFMPEG } from '../ffmpeg/ffmpeg';
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

  createSession(): FfmpegTranscodeSession {
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

    const ffmpeg = new FFMPEG(this.#ffmpegSettings, this.channel);
    return ffmpeg.createWrapperConcatSession(concatUrl, childStreamMode);
  }
}
