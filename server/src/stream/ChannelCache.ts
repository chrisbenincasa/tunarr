import { InMemoryCachedDbAdapter } from '@/db/json/InMemoryCachedDbAdapter.js';
import { SchemaBackedDbAdapter } from '@/db/json/SchemaBackedJsonDBAdapter.js';
import { GlobalOptions } from '@/globals.js';
import { isDefined } from '@/util/index.js';
import constants from '@tunarr/shared/constants';
import { inject, injectable } from 'inversify';
import { isNil, isUndefined } from 'lodash-es';
import { Low } from 'lowdb';
import { join } from 'node:path';
import { z } from 'zod/v4';
import {
  StreamLineupItem,
  StreamLineupItemSchema,
  isCommercialLineupItem,
} from '../db/derived_types/StreamLineup.ts';
import { IStreamLineupCache } from '../interfaces/IStreamLineupCache.ts';
import { KEYS } from '../types/inject.ts';

const SLACK = constants.SLACK;

const streamPlayCacheItemSchema = z.object({
  timestamp: z.number(),
  lineupItem: StreamLineupItemSchema,
});
type StreamPlayCacheItem = z.infer<typeof streamPlayCacheItemSchema>;

const channelCacheSchema = z.object({
  streamPlayCache: z.record(z.string(), streamPlayCacheItemSchema).default({}),
  fillerPlayTimeCache: z.record(z.string(), z.number()).default({}),
  programPlayTimeCache: z.record(z.string(), z.number()).default({}),
});

type ChannelCacheSchema = z.infer<typeof channelCacheSchema>;

export type PersistentChannelCacheProvider =
  () => Promise<PersistentChannelCache>;

@injectable()
export class PersistentChannelCache {
  #db: Low<ChannelCacheSchema>;

  constructor(
    @inject(KEYS.GlobalOptions) private globalOptions: GlobalOptions,
  ) {
    this.#db = new Low<ChannelCacheSchema>(
      new InMemoryCachedDbAdapter(
        new SchemaBackedDbAdapter(
          channelCacheSchema,
          join(this.globalOptions.databaseDirectory, 'stream-cache.json'),
        ),
      ),
      {
        streamPlayCache: {},
        fillerPlayTimeCache: {},
        programPlayTimeCache: {},
      },
    );
  }

  async init() {
    return this.#db.read();
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

@injectable()
export class ChannelCache implements IStreamLineupCache {
  constructor(
    @inject(PersistentChannelCache)
    private persistentChannelCache: PersistentChannelCache,
  ) {}

  getCurrentLineupItem(
    channelId: string,
    timeNow: number,
  ): StreamLineupItem | undefined {
    const recorded = this.persistentChannelCache.getStreamPlayItem(channelId);
    if (isUndefined(recorded)) {
      return;
    }
    const lineupItem = { ...recorded.lineupItem };
    const timeSinceRecorded = timeNow - recorded.timestamp;
    let remainingTime = lineupItem.duration - (lineupItem.startOffset ?? 0);
    if (!isUndefined(lineupItem.streamDuration)) {
      remainingTime = Math.min(remainingTime, lineupItem.streamDuration);
    }

    if (
      timeSinceRecorded <= SLACK &&
      timeSinceRecorded + SLACK < remainingTime
    ) {
      //closed the stream and opened it again let's not lose seconds for
      //no reason
      const originalT0 = recorded.timestamp;
      if (timeNow - originalT0 <= SLACK) {
        return lineupItem;
      }
    }

    if (isDefined(lineupItem.startOffset)) {
      lineupItem.startOffset += timeSinceRecorded;
    }
    if (!isNil(lineupItem.streamDuration)) {
      lineupItem.streamDuration -= timeSinceRecorded;
      if (lineupItem.streamDuration < SLACK) {
        //let's not waste time playing some loose seconds
        return;
      }
    }
    if ((lineupItem.startOffset ?? 0) + SLACK > lineupItem.duration) {
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
      remaining = lineupItem.duration - (lineupItem.startOffset ?? 0);
    }

    if (lineupItem.type === 'program') {
      const key = this.getKey(channelId, lineupItem.programId);
      await this.persistentChannelCache.setProgramPlayTime(key, t0 + remaining);
    }

    if (isCommercialLineupItem(lineupItem)) {
      await this.persistentChannelCache.setFillerPlayTime(
        this.getKey(channelId, lineupItem.fillerId),
        t0 + remaining,
      );
    }
  }

  getProgramLastPlayTime(channelId: string, programId: string) {
    return (
      this.persistentChannelCache.getProgramPlayTime(
        this.getKey(channelId, programId),
      ) ?? 0
    );
  }

  getFillerLastPlayTime(channelId: string, fillerId: string) {
    return (
      this.persistentChannelCache.getFillerPlayTime(
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
    await this.persistentChannelCache.setStreamPlayItem(channelId, {
      timestamp: t0,
      lineupItem: lineupItem,
    });
  }

  async clearPlayback(channelId: string) {
    return await this.persistentChannelCache.clearStreamPlayItem(channelId);
  }

  // Is this necessary??
  clear() {
    // this.configCache = {};
    // this.cache = {};
    // this.channelNumbers = undefined;
  }
}
