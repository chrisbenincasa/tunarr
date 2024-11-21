import { OnDemandChannelConfig } from '@/db/derived_types/Lineup.js';
import { type IChannelDB } from '@/db/interfaces/IChannelDB.js';
import { KEYS } from '@/types/inject.js';
import { type Logger } from '@/util/logging/LoggerFactory.js';
import { MutexMap } from '@/util/mutexMap.js';
import dayjs from 'dayjs';
import { inject, injectable } from 'inversify';
import { isNull, isUndefined } from 'lodash-es';
import { GlobalScheduler } from './Scheduler.ts';

@injectable()
export class OnDemandChannelService {
  #locks: MutexMap;

  constructor(
    @inject(KEYS.Logger) private logger: Logger,
    @inject(KEYS.MutexMap) mutexMap: MutexMap,
    @inject(KEYS.ChannelDB) private channelDB: IChannelDB,
  ) {
    this.#locks = mutexMap;
  }

  async isChannelPlaying(id: string) {
    const channelAndLineup = await this.channelDB.loadChannelAndLineup(id);
    if (isNull(channelAndLineup)) {
      return false;
    }

    const { lineup } = channelAndLineup;

    return lineup.onDemandConfig?.state === 'playing';
  }

  async pauseAllChannels() {
    const channels = await this.channelDB.getAllChannels();
    const now = +dayjs();

    for (const channel of channels) {
      await this.pauseChannel(channel.uuid, now);
    }
  }

  async pauseChannel(
    channelId: string,
    stopTime?: number,
    rewindMs: number = 0,
  ) {
    return this.#locks.runWithLockId(channelId, async () => {
      const channelAndLineup = await this.loadOnDemandChannelLineup(channelId);

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

      await this.channelDB
        .updateLineupConfig(channelId, 'onDemandConfig', {
          ...(lineup.onDemandConfig ?? {}),
          state: 'paused',
          lastPaused: pauseTime,
          cursor: nextCursor,
        })
        .then(() => {
          GlobalScheduler.scheduleOneOffTask(
            KEYS.UpdateXmlTvTaskFactory,
            dayjs().add(1000),
            [channelId],
          );
        })
        .finally(() => {
          this.logger.debug(
            'Paused on-demand channel %s (at = %s)',
            channelId,
            dayjs(pauseTime).format(),
          );
        });
    });
  }

  async resumeChannel(channelId: string) {
    return this.#locks.runWithLockId(channelId, async () => {
      const channelAndLineup = await this.loadOnDemandChannelLineup(channelId);

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
      await this.channelDB
        .updateLineupConfig(channelId, 'onDemandConfig', {
          ...(lineup.onDemandConfig ?? {}),
          state: 'playing',
          lastResumed: +now,
        })
        .finally(() => {
          this.logger.debug(
            'Resumed on-demand channel %s (at = %s)',
            channelId,
            now.format(),
          );
        });

      GlobalScheduler.scheduleOneOffTask(
        KEYS.UpdateXmlTvTaskFactory,
        dayjs().add(1000),
        [channelId],
      );
    });
  }

  getLiveTimestampForConfig(
    onDemandConfig: OnDemandChannelConfig,
    channelStartTime: number,
    requestTime: number,
  ): number {
    const lastResumed = onDemandConfig.lastResumed ?? 0;
    // Don't skip milliseconds
    let sinceResume = requestTime > lastResumed ? requestTime - lastResumed : 0;
    if (sinceResume < 1000) {
      sinceResume = 0;
    }

    return channelStartTime + onDemandConfig.cursor + sinceResume;
  }

  async getLiveTimestamp(
    channelId: string,
    requestTime: number,
  ): Promise<number> {
    const channelAndLineup = await this.loadOnDemandChannelLineup(channelId);

    if (isUndefined(channelAndLineup)) {
      return requestTime;
    }

    const { channel, lineup } = channelAndLineup;

    if (isUndefined(lineup.onDemandConfig)) {
      return requestTime;
    }

    return this.getLiveTimestampForConfig(
      lineup.onDemandConfig,
      channel.startTime,
      requestTime,
    );
  }

  private async loadOnDemandChannelLineup(id: string) {
    const channelAndLineup = await this.channelDB.loadChannelAndLineup(id);
    if (isNull(channelAndLineup)) {
      return;
    }

    return channelAndLineup;
  }
}
