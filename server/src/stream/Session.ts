import { ChannelStreamMode } from '@tunarr/types';
import { StreamConnectionDetails } from '@tunarr/types/api';
import { Mutex } from 'async-mutex';
import dayjs from 'dayjs';
import ld, { forEach, isEmpty, keys } from 'lodash-es';
import events from 'node:events';
import { StrictExtract } from 'ts-essentials';
import { v4 } from 'uuid';
import { Channel } from '../dao/direct/derivedTypes.js';
import { TypedEventEmitter } from '../types/eventEmitter';
import { Result } from '../types/result.js';
import { Maybe } from '../types/util.js';
import { Logger, LoggerFactory } from '../util/logging/LoggerFactory';
import { ConnectionTracker } from './ConnectionTracker';

const ConcatSessionSuffix = '_concat';

type SessionState = 'starting' | 'started' | 'error' | 'stopped' | 'init';

export type SessionOptions = {
  cleanupDelay?: number;
  stalenessMs?: number;
};

export type ConcatSessionType = `${StrictExtract<
  ChannelStreamMode,
  'hls' | 'hls_slower' | 'mpegts'
>}${typeof ConcatSessionSuffix}`;

export type HlsSessionType = StrictExtract<
  ChannelStreamMode,
  'hls' | 'hls_slower'
>;

export type HlsConcatSessionType =
  `${HlsSessionType}${typeof ConcatSessionSuffix}`;

export type SessionType = ChannelStreamMode | ConcatSessionType;

type StreamSessionEvents = {
  state: (newState: SessionState, oldState: SessionState) => void;
  start: () => void;
  stop: () => void;
  cleanup: () => void;
  cleanupScheduled: (delayMs: number) => void;
  error: (e: unknown) => void;
  addConnection: (token: string, connection: StreamConnectionDetails) => void;
  removeConnection: (
    token: string,
    connection: StreamConnectionDetails,
  ) => void;
};

export abstract class Session<
  TOpts extends SessionOptions = SessionOptions,
> extends (events.EventEmitter as new () => TypedEventEmitter<StreamSessionEvents>) {
  public abstract readonly sessionType: SessionType;
  protected lock = new Mutex();
  protected logger: Logger;
  protected sessionOptions: TOpts;
  protected channel: Channel;
  protected state: SessionState = 'init';
  protected connectionTracker: ConnectionTracker<StreamConnectionDetails>;

  #uniqueId: string;

  error: Maybe<Error>;

  constructor(channel: Channel, opts: TOpts) {
    super();
    this.#uniqueId = v4();
    this.logger = LoggerFactory.child({
      caller: import.meta,
      sessionId: this.#uniqueId,
      channel: channel.uuid,
      className: this.constructor.name,
    });
    this.sessionOptions = opts;
    this.channel = channel;
    this.connectionTracker = new ConnectionTracker(this.channel.uuid);
    this.connectionTracker.on('cleanup', () => {
      this.stop()
        .catch(console.error)
        .finally(() => this.emit('cleanup'));
    });
  }

  get key() {
    return `${this.channel.uuid}_${this.sessionType}`;
  }

  get keyObj() {
    return {
      id: this.channel.uuid,
      sessionType: this.sessionType,
    };
  }

  /**
   * Initialize this shared stream session if it hasn't been already.
   */
  async start() {
    await this.lock.runExclusive(async () => {
      if (!this.logger.bindings()['sessionType']) {
        this.logger.setBindings({ sessionType: this.sessionType });
      }

      if (this.state === 'started') {
        this.logger.warn('Tried to start session that has already begun!');
        return;
      }

      if (this.state === 'error') {
        this.logger.error(
          this.error,
          'Session experienced an error. Please retry later',
        );
        return;
      }

      try {
        const oldState = this.state;
        this.state = 'starting';
        this.emit('state', 'started', oldState);
        this.emit('start');
        await this.startInternal();
        await this.waitForStreamReadyInternal();
        this.state = 'started';
      } catch (e) {
        this.logger.error(e);
        this.state = 'error';
        this.emit('error', e);
      }
    });
  }

  protected abstract startInternal(): Promise<void>;

  /**
   * End this shared session. This will stop the stream for all
   * participants.
   */
  async stop() {
    await this.lock.runExclusive(async () => {
      if (this.state === 'started') {
        this.logger.debug('Stopping stream session', this.channel.uuid);
        await this.stopInternal();
        this.emit('stop');
      } else {
        this.logger.debug(
          'Wanted to shutdown session but state was %s',
          this.state,
        );
      }
    });
  }

  protected abstract stopInternal(): Promise<void>;

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

  get id() {
    return this.key;
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

  isConcatSession(): this is Omit<Session, 'sessionType'> & {
    sessionType: ConcatSessionType;
  } {
    return this.sessionType.endsWith(ConcatSessionSuffix);
  }

  addConnection(token: string, connection: StreamConnectionDetails) {
    this.connectionTracker.addConnection(token, connection);
    this.emit('addConnection', token, connection);
  }

  removeConnection(token: string) {
    const deletedConn = this.connectionTracker.removeConnection(token);
    if (deletedConn) {
      this.emit('removeConnection', token, deletedConn);
    }
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
    this.emit('cleanupScheduled', delay);
    return this.connectionTracker.scheduleCleanup(delay);
  }

  /**
   * @returns the remaining active sessions
   */
  removeStaleConnections() {
    const now = dayjs().valueOf();
    const [aliveConnections, staleConnections] = ld
      .chain(keys(this.connections()))
      .partition(
        (token) =>
          now - this.lastHeartbeat(token) <
          (this.sessionOptions.stalenessMs ?? 30_000),
      )
      .value();

    // Cleanup stale connections
    forEach(staleConnections, (conn) => this.removeConnection(conn));

    return aliveConnections;
  }

  isStale(): boolean {
    return isEmpty(this.removeStaleConnections());
  }
}
