import { once, round } from 'lodash-es';
import { Readable } from 'node:stream';
import { v4 } from 'uuid';
import { Channel } from '../dao/direct/derivedTypes.js';
import { VideoStreamResult } from '../ffmpeg/FfmpegOutputStream.js';
import { Result } from '../types/result.js';
import { Logger, LoggerFactory } from '../util/logging/LoggerFactory.js';
import { ConnectionTracker } from './ConnectionTracker.js';

type SessionState = 'starting' | 'started' | 'error' | 'stopped' | 'init';

export type StreamConnectionDetails = {
  ip: string;
  userAgent?: string;
};

export type SessionType = 'hls' | 'concat' | 'concat_hls';

export type SessionOptions = {
  sessionType: SessionType;
};

/**
 * Base class for a shared stream session where all participants share
 * the same underlying stream resource (e.g. HLS segment files, raw FFMPEG concat output)
 */
export abstract class StreamSession<
  TOpts extends SessionOptions = SessionOptions,
> {
  protected logger: Logger;
  protected sessionOptions: TOpts;
  protected channel: Channel;
  protected state: SessionState = 'init';
  protected connectionTracker: ConnectionTracker<StreamConnectionDetails>;

  #uniqueId: string;
  #stream: Readable;

  error?: Error;

  protected constructor(channel: Channel, opts: TOpts) {
    this.#uniqueId = v4();
    this.logger = LoggerFactory.child({
      caller: import.meta,
      sessionId: this.#uniqueId,
      sessionType: opts.sessionType,
      channel: channel.uuid,
      className: this.constructor.name,
    });
    this.sessionOptions = opts;
    this.channel = channel;
    this.connectionTracker = new ConnectionTracker();
    this.connectionTracker.on('cleanup', () => this.stop());
  }

  /**
   * Initialize this shared stream session if it hasn't been already.
   */
  async start() {
    if (this.state !== 'starting') {
      this.state = 'starting';
      await this.startStream();
    }
  }

  /**
   * End this shared session. This will stop the stream for all
   * participants.
   */
  stop() {
    if (this.state === 'started') {
      this.logger.debug('Stopping stream session', this.channel.uuid);
      setImmediate(() => {
        this.stopStream().catch((e) => {
          this.logger.error(e, 'Error while cleaning up stream session');
          this.state = 'error';
        });
      });
      this.state = 'stopped';
    } else {
      this.logger.debug(
        'Wanted to shutdown session but state was %s',
        this.state,
      );
    }
  }

  protected abstract stopStream(): Promise<void>;

  private async startStream() {
    const start = performance.now();

    const streamInitResult = await this.initializeStream();

    if (streamInitResult.type === 'error') {
      this.state = 'error';
      return;
    }

    this.#stream = streamInitResult.stream;

    const onceListener = once(() => {
      const end = performance.now();
      this.logger.debug(
        `Took stream ${round(end - start, 4)}ms to provide data`,
      );
      this.#stream.removeListener('data', onceListener);
    });

    this.#stream.once('data', onceListener);

    await this.waitForStreamReadyInternal();
  }

  get id() {
    return this.#uniqueId;
  }

  get started() {
    return this.state === 'started';
  }

  get stopped() {
    return this.state === 'stopped';
  }

  get hasError() {
    return this.state === 'error';
  }

  get rawStream() {
    return this.#stream;
  }

  get sessionType() {
    return this.sessionOptions.sessionType;
  }

  addConnection(token: string, connection: StreamConnectionDetails) {
    this.connectionTracker.addConnection(token, connection);
  }

  removeConnection(token: string) {
    this.connectionTracker.removeConnection(token);
  }

  connections() {
    return this.connectionTracker.connections();
  }

  isKnownConnection(token: string) {
    return this.connectionTracker.isKnownConnection(token);
  }

  numConnections() {
    return this.connectionTracker.numConnections();
  }

  recordHeartbeat(token: string) {
    this.connectionTracker.recordHeartbeat(token);
  }

  lastHeartbeat(token: string) {
    return this.connectionTracker.lastHeartbeat(token);
  }

  scheduleCleanup(delay: number) {
    this.connectionTracker.scheduleCleanup(delay);
  }

  protected abstract initializeStream(): Promise<VideoStreamResult>;

  // Override if there are conditions to wait for until the stream is ready to return
  protected waitForStreamReady(): Promise<Result<void>> {
    return Promise.resolve(Result.success(void 0));
  }

  private async waitForStreamReadyInternal() {
    const waitResult = await this.waitForStreamReady();

    if (waitResult.isFailure()) {
      this.state = 'error';
      this.error = waitResult.error;
    } else {
      this.state = 'started';
    }
  }
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
