import { once, round } from 'lodash-es';
import { Readable } from 'node:stream';
import { Channel } from '../dao/direct/derivedTypes.js';
import { FfmpegTranscodeSession } from '../ffmpeg/FfmpegTrancodeSession.js';
import { Session, SessionOptions } from './Session.js';

/**
 * Base class for a shared stream session where all participants share
 * the same underlying {@link Readable} stream.
 */
export abstract class DirectStreamSession<
  TOpts extends SessionOptions = SessionOptions,
> extends Session<TOpts> {
  #stream: Readable;

  protected constructor(channel: Channel, opts: TOpts) {
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
            reject(e);
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

  protected startInternal() {
    const start = performance.now();

    const streamInitResult = this.initializeStream();

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

  protected abstract initializeStream(): FfmpegTranscodeSession;
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
