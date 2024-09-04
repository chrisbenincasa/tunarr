import { Channel } from '../dao/direct/derivedTypes.js';
import { VideoStreamResult } from '../ffmpeg/FfmpegOutputStream.js';
import { ConcatOptions } from '../ffmpeg/ffmpeg.js';
import { isDefined } from '../util';
import { ConcatStream } from './ConcatStream';
import { SessionOptions, StreamSession } from './StreamSession';

export interface ConcatSessionOptions extends SessionOptions, ConcatOptions {
  audioOnly: boolean;
}

export class ConcatSession extends StreamSession<ConcatSessionOptions> {
  #stream: VideoStreamResult;

  protected constructor(channel: Channel, options: ConcatSessionOptions) {
    super(channel, options);
  }

  static create(channel: Channel, options: ConcatSessionOptions) {
    return new ConcatSession(channel, options);
  }

  protected async initializeStream(): Promise<VideoStreamResult> {
    this.#stream = await new ConcatStream(this.sessionOptions).startStream(
      this.channel.uuid,
      /* audioOnly */ this.sessionOptions.audioOnly,
    );
    return this.#stream;
  }

  protected stopStream(): Promise<void> {
    if (isDefined(this.#stream) && this.#stream.type === 'success') {
      this.#stream.stop();
    }

    return Promise.resolve(void 0);
  }
}
