import { isNull, isUndefined } from 'lodash-es';
import { ChannelDB } from '../dao/channelDb.js';
import dayjs from 'dayjs';

export class OnDemandChannelService {
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

  async pauseChannel(id: string, stopTime?: number) {
    const channelAndLineup = await this.loadOnDemandChannelLineup(id);

    if (isUndefined(channelAndLineup)) {
      return;
    }

    const { channel, lineup } = channelAndLineup;

    if (isUndefined(lineup.onDemandConfig)) {
      return;
    }

    // TODO: What happens if the channel lineup is modified whille
    // the stream is active?
    const pauseTime = stopTime ?? dayjs().unix() * 1000;
    const lastResumed = lineup.onDemandConfig.lastResumed ?? channel.startTime;
    const elapsed = pauseTime - lastResumed;
    // If the channel was updated after the channel was resumed, zero out the
    // cursor and start the channel from the beginning.
    const nextCursor =
      lineup.lastUpdated > lastResumed
        ? 0
        : (lineup.onDemandConfig.cursor + elapsed) % channel.duration;

    return await this.channelDB.updateLineupConfig(id, 'onDemandConfig', {
      ...(lineup.onDemandConfig ?? {}),
      state: 'paused',
      lastPaused: pauseTime,
      cursor: nextCursor,
    });
  }

  async resumeChannel(id: string) {
    const channelAndLineup = await this.loadOnDemandChannelLineup(id);

    if (isUndefined(channelAndLineup)) {
      return;
    }

    const { lineup } = channelAndLineup;

    if (isUndefined(lineup.onDemandConfig)) {
      return;
    }

    // TODO: Find the current program at the last cursor
    // and skip it if it's a commercial.

    return await this.channelDB.updateLineupConfig(id, 'onDemandConfig', {
      ...(lineup.onDemandConfig ?? {}),
      state: 'playing',
      lastResumed: dayjs().unix() * 1000,
    });
  }

  private async loadOnDemandChannelLineup(id: string) {
    const channelAndLineup = await this.channelDB.loadChannelAndLineup(id);
    if (isNull(channelAndLineup)) {
      return;
    }

    return channelAndLineup;
  }
}
