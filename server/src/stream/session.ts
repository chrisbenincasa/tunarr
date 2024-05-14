import { isEmpty, isUndefined, keys, once, round } from 'lodash-es';
import { Readable } from 'node:stream';
import { v4 } from 'uuid';
import { Channel } from '../dao/entities/Channel.js';
import { Logger, LoggerFactory } from '../util/logging/LoggerFactory.js';
import { VideoStreamResult } from './ConcatStream.js';

type SessionState = 'starting' | 'started' | 'error' | 'stopped' | 'init';

export type StreamConnectionDetails = {
  ip: string;
};

export type SessionType = 'hls' | 'concat';

export type SessionOptions = {
  sessionType: SessionType;
};

export abstract class StreamSession {
  protected logger: Logger;
  protected sessionOptions: SessionOptions;
  protected channel: Channel;
  protected state: SessionState = 'init';

  #uniqueId: string;
  #stream: Readable;
  #connections: Record<string, StreamConnectionDetails> = {};
  #heartbeats: Record<string, number> = {};
  #cleanupFunc: NodeJS.Timeout | null = null;

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
    // TODO expose this as an option on FfmpegSettings
    // This is only valid for HLS sessions
    // this.#outPath = resolve(
    //   process.cwd(),
    //   'streams',
    //   `stream_${this.channel.uuid}`,
    // );
    // this.#streamPath = join(this.#outPath, 'stream.m3u8');
    // // Direct players back to the /hls URL which will return the playlist
    // this.#serverPath = `/media-player/${this.channel.uuid}/hls`;
  }

  // static create(channel: Channel, opts: SessionOptions) {
  //   return new StreamSession(channel, opts);
  // }

  async start() {
    if (this.state !== 'starting') {
      this.state = 'starting';
      await this.startStream();
    }
  }

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
    this.#connections[token] = { ...connection };
    this.#heartbeats[token] = new Date().getTime();
    if (this.#cleanupFunc) {
      clearTimeout(this.#cleanupFunc);
    }
  }

  removeConnection(token: string) {
    delete this.#connections[token];
    delete this.#heartbeats[token];
  }

  connections() {
    return { ...this.#connections };
  }

  isKnownConnection(token: string) {
    return !isUndefined(this.#connections[token]);
  }

  numConnections() {
    return keys(this.#connections).length;
  }

  recordHeartbeat(token: string) {
    this.#heartbeats[token] = new Date().getTime();
  }

  lastHeartbeat(token: string) {
    return this.#heartbeats[token];
  }

  scheduleCleanup(delay: number) {
    if (this.#cleanupFunc) {
      this.logger.debug('Cleanup already scheduled');
      // We already scheduled shutdown
      return;
    }
    this.logger.debug('Scheduling session shutdown');
    this.#cleanupFunc = setTimeout(() => {
      this.logger.debug('Shutting down session');
      if (isEmpty(this.#connections)) {
        this.stop();
      } else {
        this.logger.debug(`Got new connections: %O`, this.#connections);
      }
    }, delay);
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
