import type { ChannelWithTranscodeConfig } from '@/db/schema/derivedTypes.js';
import type { FfmpegTranscodeSession } from '@/ffmpeg/FfmpegTrancodeSession.js';
import { once, round } from 'lodash-es';
import type { Readable } from 'node:stream';
import { caughtErrorToError } from '../util/index.ts';
import type { SessionOptions } from './Session.js';
import { Session } from './Session.js';

/**
 * Base class for a shared stream session where all participants share
 * the same underlying {@link Readable} stream.
 */
export abstract class DirectStreamSession<
  TOpts extends SessionOptions = SessionOptions,
> extends Session<TOpts> {
  #stream: Readable;

  protected constructor(channel: ChannelWithTranscodeConfig, opts: TOpts) {
    super(channel, opts);
  }

  /**
   * End this shared session. This will stop the stream for all
   * participants.
   */
  protected stopInternal() {
    return new Promise<void>((resolve, reject) => {
      setImmediate(() => {
        this.stopStream()
          .catch((e) => {
            this.logger.error(e, 'Error while cleaning up stream session');
            this.state = 'error';
            reject(caughtErrorToError(e));
          })
          .finally(() => {
            const oldState = this.state;
            this.state = 'stopped';
            this.emit('stop');
            this.emit('state', 'stopped', oldState);
            resolve(void 0);
          });
      });
    });
  }

  get rawStream() {
    return this.#stream;
  }

  protected abstract stopStream(): Promise<void>;

  protected async startInternal() {
    const start = performance.now();

    const streamInitResult = await this.initializeStream();

    this.#stream = streamInitResult.start();

    const onceListener = once(() => {
      const end = performance.now();
      this.logger.debug(
        `Took stream ${round(end - start, 4)}ms to provide data`,
      );
      this.#stream.removeListener('data', onceListener);
    });

    this.#stream.once('data', onceListener);

    return Promise.resolve(void 0);
  }

  protected abstract initializeStream(): Promise<FfmpegTranscodeSession>;
}

type StreamReadyErrorResult = {
  type: 'error';
  error?: Error;
};

type StreamReadySuccessResult = {
  type: 'success';
};

export type StreamReadyResult =
  | StreamReadySuccessResult
  | StreamReadyErrorResult;
