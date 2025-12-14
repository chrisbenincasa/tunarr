import type { TypedEventEmitter } from '@/types/eventEmitter.js';
import type { Logger } from '@/util/logging/LoggerFactory.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import type { StreamConnectionDetails } from '@tunarr/types/api';
import dayjs from 'dayjs';
import { isEmpty, isUndefined, keys } from 'lodash-es';
import events from 'node:events';

type ConnectionTrackerEvents = {
  cleanup: () => void;
};

export class ConnectionTracker<
  ConnectionDetails extends StreamConnectionDetails,
> extends (events.EventEmitter as new () => TypedEventEmitter<ConnectionTrackerEvents>) {
  #logger: Logger = LoggerFactory.child({ className: ConnectionTracker.name });
  #cleanupFunc: NodeJS.Timeout | null = null;
  #connections: Record<string, ConnectionDetails> = {};
  #heartbeats: Record<string, number> = {};

  constructor(id: string, name: string) {
    super();
    this.#logger.setBindings({ id, name });
  }

  addConnection(token: string, connection: ConnectionDetails) {
    this.#connections[token] = { ...connection };
    this.#heartbeats[token] = new Date().getTime();
    if (this.#cleanupFunc) {
      clearTimeout(this.#cleanupFunc);
      this.#cleanupFunc = null;
    }
  }

  removeConnection(token: string) {
    const conn = this.#connections[token];
    if (!conn) {
      return null;
    }
    const deleted = delete this.#connections[token];
    const lastHeartbeat = this.#heartbeats[token] ?? +dayjs();
    delete this.#heartbeats[token];
    return deleted ? { ...conn, lastHeartbeat } : null;
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
      this.#logger.debug('Cleanup already scheduled');
      // We already scheduled shutdown
      return false;
    }

    this.#logger.debug('Scheduling session shutdown');

    // TODO: Use the scheduler to do this
    this.#cleanupFunc = setTimeout(() => {
      this.#logger.debug('Shutting down connection tracker');
      if (isEmpty(this.#connections)) {
        this.emit('cleanup');
      } else {
        this.#logger.debug(
          `Aborting shutdown. Got new connections in grace period: %O`,
          this.#connections,
        );
      }

      if (this.#cleanupFunc) {
        clearTimeout(this.#cleanupFunc);
        this.#cleanupFunc = null;
      }
      // unref() so this timeout doesn't stop the process from exiting
      // exiting the process will kill all subprocesses anyway
    }, delay).unref();

    return true;
  }
}
