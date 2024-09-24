import dayjs from 'dayjs';
import { isNull, isUndefined } from 'lodash-es';
import { ChannelDB } from '../dao/channelDb.js';
import { LoggerFactory } from '../util/logging/LoggerFactory.js';
import { MutexMap } from '../util/mutexMap.js';

export class OnDemandChannelService {
  #logger = LoggerFactory.child({ className: this.constructor.name });
  #locks: MutexMap = new MutexMap();

  constructor(private channelDB: ChannelDB) {}

  async isChannelPlaying(id: string) {
    const channelAndLineup = await this.channelDB.loadChannelAndLineup(id);
    if (isNull(channelAndLineup)) {
      return false;
    }

    const { lineup } = channelAndLineup;

    return lineup.onDemandConfig?.state === 'playing';
  }

  async pauseAllChannels() {
    const allConfigs = await this.channelDB.loadAllLineupConfigs();
    const now = dayjs().unix() * 1000;
    for (const [channelId, { lineup }] of Object.entries(allConfigs)) {
      if (isUndefined(lineup.onDemandConfig)) {
        continue;
      }

      if (lineup.onDemandConfig.state === 'paused') {
        continue;
      }

      await this.channelDB.updateLineupConfig(channelId, 'onDemandConfig', {
        ...lineup.onDemandConfig,
        state: 'paused',
        lastPaused: now,
      });
    }
  }

  async pauseChannel(id: string, stopTime?: number, rewindMs: number = 0) {
    return this.#locks.runWithLockId(id, async () => {
      const channelAndLineup = await this.loadOnDemandChannelLineup(id);

      if (isUndefined(channelAndLineup)) {
        return;
      }

      const { channel, lineup } = channelAndLineup;

      if (isUndefined(lineup.onDemandConfig)) {
        return;
      }

      if (lineup.onDemandConfig.state === 'paused') {
        return;
      }

      // TODO: What happens if the channel lineup is modified whille
      // the stream is active?
      const pauseTime = stopTime ?? dayjs().valueOf();
      const lastResumed =
        lineup.onDemandConfig.lastResumed ?? channel.startTime;
      const elapsed = pauseTime - lastResumed;
      // If the channel was updated after the channel was resumed, zero out the
      // cursor and start the channel from the beginning.
      const nextCursor =
        lineup.lastUpdated > lastResumed
          ? 0
          : (lineup.onDemandConfig.cursor + elapsed - rewindMs) %
            channel.duration;

      return await this.channelDB
        .updateLineupConfig(id, 'onDemandConfig', {
          ...(lineup.onDemandConfig ?? {}),
          state: 'paused',
          lastPaused: pauseTime,
          cursor: nextCursor,
        })
        .finally(() => {
          this.#logger.debug(
            'Paused on-demand channel %s (at = %s)',
            id,
            dayjs(pauseTime).format(),
          );
        });
    });
  }

  async resumeChannel(id: string) {
    return this.#locks.runWithLockId(id, async () => {
      const channelAndLineup = await this.loadOnDemandChannelLineup(id);

      if (isUndefined(channelAndLineup)) {
        return;
      }

      const { lineup } = channelAndLineup;

      if (isUndefined(lineup.onDemandConfig)) {
        return;
      }

      if (lineup.onDemandConfig.state === 'playing') {
        return;
      }

      // TODO: Find the current program at the last cursor
      // and skip it if it's a commercial.

      const now = dayjs();
      return await this.channelDB
        .updateLineupConfig(id, 'onDemandConfig', {
          ...(lineup.onDemandConfig ?? {}),
          state: 'playing',
          lastResumed: +now,
        })
        .finally(() => {
          this.#logger.debug(
            'Resumed on-demand channel %s (at = %s)',
            id,
            now.format(),
          );
        });
    });
  }

  async getLiveTimestamp(channelId: string, requestTime: number) {
    const channelAndLineup = await this.loadOnDemandChannelLineup(channelId);

    if (isUndefined(channelAndLineup)) {
      return requestTime;
    }

    const { channel, lineup } = channelAndLineup;

    if (isUndefined(lineup.onDemandConfig)) {
      return requestTime;
    }

    let sinceResume = dayjs(requestTime).diff(
      dayjs(lineup.onDemandConfig.lastResumed),
    );

    // Don't skip milliseconds
    if (sinceResume < 1_000) {
      sinceResume = 0;
    }

    return channel.startTime + lineup.onDemandConfig.cursor + sinceResume;
  }

  private async loadOnDemandChannelLineup(id: string) {
    const channelAndLineup =
      await this.channelDB.loadDirectChannelAndLineup(id);
    if (isNull(channelAndLineup)) {
      return;
    }

    return channelAndLineup;
  }
}
