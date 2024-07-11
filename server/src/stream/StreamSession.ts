import { once, round } from 'lodash-es';
import { Readable } from 'node:stream';
import { v4 } from 'uuid';
import { Channel } from '../dao/entities/Channel.js';
import { Logger, LoggerFactory } from '../util/logging/LoggerFactory.js';
import { VideoStreamResult } from './ConcatStream.js';
import { ConnectionTracker } from './ConnectionTracker.js';

type SessionState = 'starting' | 'started' | 'error' | 'stopped' | 'init';

export type StreamConnectionDetails = {
  ip: string;
};

export type SessionType = 'hls' | 'concat';

export type SessionOptions = {
  sessionType: SessionType;
};

/**
 * Base class for a shared stream session where all participants share
 * the same underlying stream resource (e.g. HLS segment files, raw FFMPEG concat output)
 */
export abstract class StreamSession {
  protected logger: Logger;
  protected sessionOptions: SessionOptions;
  protected channel: Channel;
  protected state: SessionState = 'init';
  protected connectionTracker: ConnectionTracker<StreamConnectionDetails>;

  #uniqueId: string;
  #stream: Readable;

  protected constructor(channel: Channel, opts: SessionOptions) {
    this.#uniqueId = v4();
    this.logger = LoggerFactory.child({
      caller: import.meta,
      sessionId: this.#uniqueId,
      sessionType: opts.sessionType,
      channel: channel.uuid,
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
  protected waitForStreamReady(): Promise<StreamReadyResult> {
    return Promise.resolve({ type: 'success' });
  }

  private async waitForStreamReadyInternal() {
    const waitResult = await this.waitForStreamReady();

    if (waitResult.type === 'error') {
      this.state = 'error';
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
