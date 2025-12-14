import type { ChannelWithTranscodeConfig } from '@/db/schema/derivedTypes.js';
import type { TypedEventEmitter } from '@/types/eventEmitter.js';
import { Result } from '@/types/result.js';
import type { Maybe } from '@/types/util.js';
import type { Logger } from '@/util/logging/LoggerFactory.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import type { ChannelStreamMode } from '@tunarr/types';
import type { StreamConnectionDetails } from '@tunarr/types/api';
import type { ChannelConcatStreamMode } from '@tunarr/types/schemas';
import { Mutex } from 'async-mutex';
import dayjs from 'dayjs';
import { forEach, isEmpty, keys, partition } from 'lodash-es';
import events from 'node:events';
import type { StrictExtract } from 'ts-essentials';
import { v4 } from 'uuid';
import { ConnectionTracker } from './ConnectionTracker.ts';

const ConcatSessionSuffix = '_concat';

type SessionState = 'starting' | 'started' | 'error' | 'stopped' | 'init';

export type SessionOptions = {
  cleanupDelay?: number;
  stalenessMs?: number;
};

export type HlsSessionType = StrictExtract<
  ChannelStreamMode,
  'hls' | 'hls_slower' | 'hls_direct'
>;

export type HlsConcatSessionType =
  `${HlsSessionType}${typeof ConcatSessionSuffix}`;

export type SessionType = ChannelStreamMode | ChannelConcatStreamMode;

// TODO: sort these all out.... and write docs
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
  end: () => void;
};

export abstract class Session<
  TOpts extends SessionOptions = SessionOptions,
> extends (events.EventEmitter as new () => TypedEventEmitter<StreamSessionEvents>) {
  public abstract readonly sessionType: SessionType;
  protected lock = new Mutex();
  protected logger: Logger;
  protected sessionOptions: TOpts;
  protected channel: ChannelWithTranscodeConfig;
  protected connectionTracker: ConnectionTracker<StreamConnectionDetails>;

  #state: SessionState = 'init';
  #uniqueId: string;

  error: Maybe<Error>;

  constructor(channel: ChannelWithTranscodeConfig, opts: TOpts) {
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
    this.connectionTracker = new ConnectionTracker(
      this.channel.uuid,
      `channel_${this.channel.uuid}_${this.constructor.name}`,
    );
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

  get state() {
    return this.#state;
  }

  protected set state(next: SessionState) {
    if (this.#state === next) {
      return;
    }

    this.emit('state', next, this.#state);
    this.#state = next;
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
        this.state = 'starting';
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
      switch (this.state) {
        case 'starting':
        case 'started':
          this.logger.debug('Stopping stream session: %s', this.channel.uuid);
          await this.stopInternal();
          return;
        case 'error':
          this.logger.debug('Session already in error state. Cleaning it up.');
          await this.stopInternal();
          return;
        default:
          this.logger.debug(
            'Wanted to shutdown session but state was %s',
            this.state,
          );
          return;
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

    if (waitResult.isFailure()) {
      this.state = 'error';
      this.error = waitResult.error;
      this.emit('error', this.error);
    } else {
      this.state = 'started';
      this.emit('start');
    }
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
    sessionType: ChannelConcatStreamMode;
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
    // Trigger cleanup immediately if we're in an error state
    if (this.state === 'error') {
      this.stop().catch((e) => {
        this.logger.error(e);
      });
      return true;
    } else {
      const cleanupScheduled = this.connectionTracker.scheduleCleanup(delay);
      if (cleanupScheduled) {
        this.logger.debug(
          'Session in state "%s" got cleanup command.',
          this.state,
        );
        this.emit('cleanupScheduled', delay);
      }
      return cleanupScheduled;
    }
  }

  /**
   * @returns the remaining active sessions
   */
  removeStaleConnections() {
    const now = dayjs().valueOf();
    const [aliveConnections, staleConnections] = partition(
      keys(this.connections()),
      (token) =>
        now - this.lastHeartbeat(token)! <
        (this.sessionOptions.stalenessMs ?? 30_000),
    );

    // Cleanup stale connections
    forEach(staleConnections, (conn) => this.removeConnection(conn));

    return aliveConnections;
  }

  isStale(): boolean {
    return this.state !== 'starting' && isEmpty(this.removeStaleConnections());
  }
}
