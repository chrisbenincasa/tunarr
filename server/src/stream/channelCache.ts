import constants from '@tunarr/shared/constants';
import { isNil, isUndefined } from 'lodash-es';
import { z } from 'zod';
import {
  StreamLineupItem,
  StreamLineupItemSchema,
  isCommercialLineupItem,
} from '../dao/derived_types/StreamLineup.js';
import { FillerShowId } from '../dao/entities/FillerShow.js';
import { SchemaBackedDbAdapter } from '../dao/SchemaBackedDbAdapter.js';
import { join } from 'node:path';
import { Low } from 'lowdb';
import { globalOptions } from '../globals.js';
import { InMemoryCachedDbAdapter } from '../dao/InMemoryCachedDbAdapter.js';

const SLACK = constants.SLACK;

const streamPlayCacheItemSchema = z.object({
  timestamp: z.number(),
  lineupItem: StreamLineupItemSchema,
});
type StreamPlayCacheItem = z.infer<typeof streamPlayCacheItemSchema>;

const channelCacheSchema = z.object({
  streamPlayCache: z.record(streamPlayCacheItemSchema),
  fillerPlayTimeCache: z.record(z.number()),
  programPlayTimeCache: z.record(z.number()),
});

type ChannelCacheSchema = z.infer<typeof channelCacheSchema>;

class PersistentChannelCache {
  #initialized: boolean = false;
  #db: Low<ChannelCacheSchema>;

  async init() {
    if (!this.#initialized) {
      this.#db = new Low<ChannelCacheSchema>(
        new InMemoryCachedDbAdapter(
          new SchemaBackedDbAdapter(
            channelCacheSchema,
            join(globalOptions().databaseDirectory, 'stream-cache.json'),
          ),
        ),
        {
          streamPlayCache: {},
          fillerPlayTimeCache: {},
          programPlayTimeCache: {},
        },
      );
      return await this.#db.read();
    }
  }

  getStreamPlayItem(channelId: string): StreamPlayCacheItem | undefined {
    return this.#db.data.streamPlayCache[channelId];
  }

  setStreamPlayItem(channelId: string, item: StreamPlayCacheItem) {
    return this.#db.update(({ streamPlayCache }) => {
      streamPlayCache[channelId] = item;
    });
  }

  clearStreamPlayItem(channelId: string) {
    return this.#db.update(({ streamPlayCache }) => {
      delete streamPlayCache[channelId];
    });
  }

  getProgramPlayTime(id: string): number | undefined {
    return this.#db.data.programPlayTimeCache[id];
  }

  setProgramPlayTime(id: string, time: number) {
    return this.#db.update(({ programPlayTimeCache }) => {
      programPlayTimeCache[id] = time;
    });
  }

  getFillerPlayTime(id: string): number | undefined {
    return this.#db.data.fillerPlayTimeCache[id];
  }

  setFillerPlayTime(id: string, time: number) {
    return this.#db.update(({ fillerPlayTimeCache }) => {
      fillerPlayTimeCache[id] = time;
    });
  }
}

const persistentChannelCache = new PersistentChannelCache();

export const initPersistentStreamCache = () => persistentChannelCache.init();

export class ChannelCache {
  getCurrentLineupItem(
    channelId: string,
    timeNow: number,
  ): StreamLineupItem | undefined {
    const recorded = persistentChannelCache.getStreamPlayItem(channelId);
    if (isUndefined(recorded)) {
      return;
    }
    const lineupItem = { ...recorded.lineupItem };
    const timeSinceRecorded = timeNow - recorded.timestamp;
    let remainingTime = lineupItem.duration - (lineupItem.start ?? 0);
    if (!isUndefined(lineupItem.streamDuration)) {
      remainingTime = Math.min(remainingTime, lineupItem.streamDuration);
    }

    if (
      timeSinceRecorded <= SLACK &&
      timeSinceRecorded + SLACK < remainingTime
    ) {
      //closed the stream and opened it again let's not lose seconds for
      //no reason
      const originalT0 =
        recorded.lineupItem.originalTimestamp ?? recorded.timestamp;
      if (timeNow - originalT0 <= SLACK) {
        lineupItem.originalTimestamp = originalT0;
        return lineupItem;
      }
    }

    lineupItem.start
      ? (lineupItem.start += timeSinceRecorded)
      : timeSinceRecorded;
    if (!isNil(lineupItem.streamDuration)) {
      lineupItem.streamDuration -= timeSinceRecorded;
      if (lineupItem.streamDuration < SLACK) {
        //let's not waste time playing some loose seconds
        return;
      }
    }
    if ((lineupItem.start ?? 0) + SLACK > lineupItem.duration) {
      return;
    }
    return lineupItem;
  }

  private getKey(channelId: string, programId: string) {
    return `${channelId}|${programId}`;
  }

  private async recordProgramPlayTime(
    channelId: string,
    lineupItem: StreamLineupItem,
    t0: number,
  ) {
    let remaining: number;
    if (!isUndefined(lineupItem.streamDuration)) {
      remaining = lineupItem.streamDuration;
    } else {
      remaining = lineupItem.duration - (lineupItem.start ?? 0);
    }

    if (lineupItem.type === 'program') {
      const key = this.getKey(channelId, lineupItem.programId);
      await persistentChannelCache.setProgramPlayTime(key, t0 + remaining);
    }

    if (isCommercialLineupItem(lineupItem)) {
      await persistentChannelCache.setFillerPlayTime(
        this.getKey(channelId, lineupItem.programId),
        t0 + remaining,
      );
    }
  }

  getProgramLastPlayTime(channelId: string, programId: string) {
    return (
      persistentChannelCache.getProgramPlayTime(
        this.getKey(channelId, programId),
      ) ?? 0
    );
  }

  getFillerLastPlayTime(channelId: string, fillerId: FillerShowId) {
    return (
      persistentChannelCache.getFillerPlayTime(
        this.getKey(channelId, fillerId),
      ) ?? 0
    );
  }

  async recordPlayback(
    channelId: string,
    t0: number,
    lineupItem: StreamLineupItem,
  ) {
    await this.recordProgramPlayTime(channelId, lineupItem, t0);
    await persistentChannelCache.setStreamPlayItem(channelId, {
      timestamp: t0,
      lineupItem: lineupItem,
    });
  }

  async clearPlayback(channelId: string) {
    return await persistentChannelCache.clearStreamPlayItem(channelId);
  }

  // Is this necessary??
  clear() {
    // this.configCache = {};
    // this.cache = {};
    // this.channelNumbers = undefined;
  }
}
