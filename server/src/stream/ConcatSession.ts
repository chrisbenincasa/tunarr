import { ChannelWithTranscodeConfig } from '@/db/schema/derivedTypes.js';
import { FfmpegTranscodeSession } from '@/ffmpeg/FfmpegTrancodeSession.js';
import { isEmpty } from 'lodash-es';
import { ConcatStream } from './ConcatStream.ts';
import { DirectStreamSession } from './DirectStreamSession.js';
import { ConcatSessionType, SessionOptions } from './Session.js';

export type ConcatSessionOptions = SessionOptions & {
  sessionType: ConcatSessionType;
  audioOnly: boolean;
  // concatOptions: ConcatOptions;
};

export class ConcatSession extends DirectStreamSession<ConcatSessionOptions> {
  #transcodeSession: FfmpegTranscodeSession;

  constructor(
    channel: ChannelWithTranscodeConfig,
    options: ConcatSessionOptions,
  ) {
    super(channel, options);
    this.on('removeConnection', () => {
      if (isEmpty(this.connections())) {
        this.scheduleCleanup(5_000);
      }
    });
  }

  isStale(): boolean {
    return isEmpty(this.connections());
  }

  get sessionType() {
    return this.sessionOptions.sessionType;
  }

  protected async initializeStream(): Promise<FfmpegTranscodeSession> {
    this.#transcodeSession = await new ConcatStream(
      this.channel,
      this.sessionOptions.sessionType,
    ).createSession();

    this.#transcodeSession.on('error', (e) => this.emit('error', e));
    this.#transcodeSession.on('exit', () => this.emit('end'));

    return Promise.resolve(this.#transcodeSession);
  }

  protected stopStream(): Promise<void> {
    this.#transcodeSession?.kill();
    return Promise.resolve(void 0);
  }
}
