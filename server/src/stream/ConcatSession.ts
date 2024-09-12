import { isEmpty } from 'lodash-es';
import { Channel } from '../dao/direct/derivedTypes.js';
import { FfmpegTranscodeSession } from '../ffmpeg/FfmpegTrancodeSession.js';
import { ConcatOptions } from '../ffmpeg/ffmpeg.js';
import { Result } from '../types/result.js';
import { isDefined } from '../util';
import { ConcatStream } from './ConcatStream';
import { SessionOptions, StreamSession } from './StreamSession';

export interface ConcatSessionOptions extends SessionOptions, ConcatOptions {
  audioOnly: boolean;
}

export class ConcatSession extends StreamSession<ConcatSessionOptions> {
  #session: FfmpegTranscodeSession;

  protected constructor(channel: Channel, options: ConcatSessionOptions) {
    super(channel, options);
  }

  static create(channel: Channel, options: ConcatSessionOptions) {
    return new ConcatSession(channel, options);
  }

  isStale(): boolean {
    return isEmpty(this.connections());
  }

  protected async initializeStream(): Promise<Result<FfmpegTranscodeSession>> {
    const sessionResult = await new ConcatStream(
      this.sessionOptions,
    ).startStream(
      this.channel.uuid,
      /* audioOnly */ this.sessionOptions.audioOnly,
    );

    if (sessionResult.isSuccess()) {
      this.#session = sessionResult.get();
    }

    return sessionResult;
  }

  protected stopStream(): Promise<void> {
    if (isDefined(this.#session)) {
      this.#session.kill();
    }

    return Promise.resolve(void 0);
  }
}
