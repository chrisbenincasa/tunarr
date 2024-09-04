import { Channel } from '../dao/direct/derivedTypes';
import { ConcatOptions } from '../ffmpeg/ffmpeg';
import { FfmpegTranscodeSession } from '../ffmpeg/FfmpegTrancodeSession';
import { makeLocalUrl } from '../util/serverUtil.js';
import { FfmpegOutputStream } from '../ffmpeg/FfmpegOutputStream.js';

type ConcatStreamOptions = {
  parentProcessType: 'hls' | 'direct';
};

export class ConcatStream extends FfmpegOutputStream {
  constructor(
    private concatOptions?: Partial<ConcatOptions & ConcatStreamOptions>,
  ) {
    super();
  }

  protected initializeStream(
    channel: Channel,
  ): Promise<FfmpegTranscodeSession> {
    const concatUrl =
      this.concatOptions?.mode === 'hls'
        ? makeLocalUrl(`/media-player/${channel.uuid}/hls`)
        : makeLocalUrl('/playlist', {
            channel: channel.number,
            audioOnly: false,
            hls: this.concatOptions?.parentProcessType === 'hls',
          });

    const ffmpegSession =
      this.concatOptions?.mode === 'hls'
        ? this.ffmpeg.createHlsConcatSession(concatUrl)
        : this.ffmpeg.createConcatSession(concatUrl, this.concatOptions);

    return Promise.resolve(ffmpegSession);
  }
}
