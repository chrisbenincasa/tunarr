import { isEmpty } from 'lodash-es';
import { Channel } from '../dao/direct/derivedTypes.js';
import { FfmpegTranscodeSession } from '../ffmpeg/FfmpegTrancodeSession.js';
import { ConcatOptions } from '../ffmpeg/ffmpeg.js';
import { ConcatStream } from './ConcatStream';
import { DirectStreamSession } from './DirectStreamSession.js';
import { ConcatSessionType, SessionOptions } from './Session.js';

export type ConcatSessionOptions = SessionOptions & {
  sessionType: ConcatSessionType;
  audioOnly: boolean;
  concatOptions: ConcatOptions;
};

export class ConcatSession extends DirectStreamSession<ConcatSessionOptions> {
  #transcodeSession: FfmpegTranscodeSession;

  constructor(channel: Channel, options: ConcatSessionOptions) {
    super(channel, options);
  }

  isStale(): boolean {
    return isEmpty(this.connections());
  }

  get sessionType() {
    return this.sessionOptions.sessionType;
  }

  protected initializeStream(): FfmpegTranscodeSession {
    this.#transcodeSession = new ConcatStream(this.channel, {
      ...this.sessionOptions.concatOptions,
      mode: this.sessionOptions.sessionType,
      logOutput: true,
    }).createSession();

    this.#transcodeSession.on('error', (e) => this.emit('error', e));

    return this.#transcodeSession;
  }

  protected stopStream(): Promise<void> {
    this.#transcodeSession?.kill();
    return Promise.resolve(void 0);
  }
}
