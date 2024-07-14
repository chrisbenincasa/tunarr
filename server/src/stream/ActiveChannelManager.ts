import { GlobalScheduler } from '../services/scheduler';
import { OnDemandChannelStateTask } from '../tasks/OnDemandChannelStateTask';
import { Logger, LoggerFactory } from '../util/logging/LoggerFactory';
import { ConnectionTracker } from './ConnectionTracker';

type ChannelConnectionDetails = {
  ipAddress: string;
};

class ActiveChannelManagerImpl {
  #logger: Logger = LoggerFactory.child({
    caller: import.meta,
    className: this.constructor.name,
  });

  // A connection tracker per channel ID
  #channelTrackers: Record<
    string,
    ConnectionTracker<ChannelConnectionDetails>
  > = {};

  addChannelConnection(
    channelId: string,
    token: string,
    details: ChannelConnectionDetails,
  ) {
    if (!this.#channelTrackers[channelId]) {
      this.#channelTrackers[channelId] = new ConnectionTracker();
    }

    this.#channelTrackers[channelId].addConnection(token, details);

    this.#logger.debug(
      'Added channel connection for %s with token %s. %O',
      channelId,
      token,
      details,
    );
  }

  removeChannelConnection(channelId: string, token: string) {
    if (!this.#channelTrackers[channelId]) {
      this.#logger.warn(
        'Attempted to remove channel connection that was seemingly never initialized...',
      );
    }

    this.#channelTrackers[channelId].removeConnection(token);

    this.#logger.debug(
      'Removed connection from channel %s for token %s. %d remaining connections',
      channelId,
      token,
      this.#channelTrackers[channelId].numConnections(),
    );

    if (this.#channelTrackers[channelId].numConnections() === 0) {
      GlobalScheduler.getScheduledJob(OnDemandChannelStateTask.ID)
        .runNow()
        .catch((e) => this.#logger.error(e));
    }
  }

  numConnectionsForChannel(channelId: string) {
    if (!this.#channelTrackers[channelId]) {
      return 0;
    }

    return this.#channelTrackers[channelId].numConnections();
  }

  scheduleChannelCleanup(channelId: string, cb: () => void) {
    if (this.#channelTrackers[channelId]) {
      const tracker = this.#channelTrackers[channelId];
      tracker.scheduleCleanup(0);
      tracker.once('cleanup', () => {
        delete this.#channelTrackers[channelId];
        cb();
      });
    }
  }
}

// Singleton
export const ActiveChannelManager = new ActiveChannelManagerImpl();
