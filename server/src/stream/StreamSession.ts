import dayjs from 'dayjs';
import events from 'events';
import ld, { forEach, keys, once, round } from 'lodash-es';
import { Readable } from 'node:stream';
import { PassThrough } from 'stream';
import { v4 } from 'uuid';
import { Channel } from '../dao/direct/derivedTypes.js';
import { FfmpegTranscodeSession } from '../ffmpeg/FfmpegTrancodeSession.js';
import { TypedEventEmitter } from '../types/eventEmitter.js';
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
  cleanupDelay?: number;
};

type StreamSessionEvents = {
  state: (newState: SessionState, oldState: SessionState) => void;
  start: () => void;
  stop: () => void;
  cleanup: () => void;
  error: (e: unknown) => void;
};

/**
 * Base class for a shared stream session where all participants share
 * the same underlying stream resource (e.g. HLS segment files, raw FFMPEG concat output)
 */
export abstract class StreamSession<
  TOpts extends SessionOptions = SessionOptions,
> extends (events.EventEmitter as new () => TypedEventEmitter<StreamSessionEvents>) {
  protected logger: Logger;
  protected sessionOptions: TOpts;
  protected channel: Channel;
  protected state: SessionState = 'init';
  protected connectionTracker: ConnectionTracker<StreamConnectionDetails>;

  #uniqueId: string;
  #stream: Readable;

  error?: Error;

  protected constructor(channel: Channel, opts: TOpts) {
    super();
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
    this.connectionTracker = new ConnectionTracker(this.channel.uuid);
    this.connectionTracker.on('cleanup', () => {
      this.stop();
      this.emit('cleanup');
    });
  }

  get key() {
    return `${this.channel.uuid}_${this.sessionOptions.sessionType}`;
  }

  get keyObj() {
    return {
      id: this.channel.uuid,
      sessionType: this.sessionOptions.sessionType,
    };
  }

  /**
   * Initialize this shared stream session if it hasn't been already.
   */
  async start() {
    if (this.state !== 'starting') {
      const oldState = this.state;
      this.state = 'starting';
      this.emit('state', 'started', oldState);
      this.emit('start');
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
        this.stopStream()
          .catch((e) => {
            this.logger.error(e, 'Error while cleaning up stream session');
            this.state = 'error';
          })
          .finally(() => {
            const oldState = this.state;
            this.state = 'stopped';
            this.emit('stop');
            this.emit('state', 'stopped', oldState);
          });
      });
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

    if (streamInitResult.isFailure()) {
      const oldState = this.state;
      this.state = 'error';
      this.emit('state', 'error', oldState);
      this.emit('error', streamInitResult.error);
      return;
    }

    this.#stream = streamInitResult.get().start(new PassThrough());

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

  scheduleCleanup(delay: number = this.sessionOptions.cleanupDelay ?? 15_000) {
    return this.connectionTracker.scheduleCleanup(delay);
  }

  /**
   * @returns the remaining active sessions
   */
  removeStaleConnections() {
    const now = dayjs().valueOf();
    const [aliveConnections, staleConnections] = ld
      .chain(keys(this.connections()))
      .partition((token) => now - this.lastHeartbeat(token) < 30_000)
      .value();

    // Cleanup stale connections
    forEach(staleConnections, (conn) => this.removeConnection(conn));

    return aliveConnections;
  }

  abstract isStale(): boolean;

  protected abstract initializeStream(): Promise<
    Result<FfmpegTranscodeSession>
  >;

  // Override if there are conditions to wait for until the stream is ready to return
  protected waitForStreamReady(): Promise<Result<void>> {
    return Promise.resolve(Result.success(void 0));
  }

  private async waitForStreamReadyInternal() {
    const waitResult = await this.waitForStreamReady();

    const oldState = this.state;
    if (waitResult.isFailure()) {
      this.state = 'error';
      this.error = waitResult.error;
      this.emit('error', this.error);
    } else {
      this.state = 'started';
      this.emit('start');
    }
    this.emit('state', this.state, oldState);
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
