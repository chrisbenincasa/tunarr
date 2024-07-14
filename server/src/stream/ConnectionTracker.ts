import { isEmpty, isUndefined, keys } from 'lodash-es';
import { Logger, LoggerFactory } from '../util/logging/LoggerFactory';
import events from 'events';
import { TypedEventEmitter } from '../types/eventEmitter';

type ConnectionTrackerEvents = {
  cleanup: () => void;
};

export class ConnectionTracker<
  ConnectionDetails extends object,
> extends (events.EventEmitter as new () => TypedEventEmitter<ConnectionTrackerEvents>) {
  #logger: Logger = LoggerFactory.child({ className: ConnectionTracker.name });
  #cleanupFunc: NodeJS.Timeout | null = null;
  #connections: Record<string, ConnectionDetails> = {};
  #heartbeats: Record<string, number> = {};

  addConnection(token: string, connection: ConnectionDetails) {
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
      this.#logger.debug('Cleanup already scheduled');
      // We already scheduled shutdown
      return;
    }
    this.#logger.debug('Scheduling session shutdown');
    this.#cleanupFunc = setTimeout(() => {
      this.#logger.debug('Shutting down session');
      if (isEmpty(this.#connections)) {
        this.emit('cleanup');
      } else {
        this.#logger.debug(`Got new connections: %O`, this.#connections);
      }
    }, delay);
  }
}
