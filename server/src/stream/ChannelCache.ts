import { InMemoryCachedDbAdapter } from '@/db/json/InMemoryCachedDbAdapter.js';
import { SchemaBackedDbAdapter } from '@/db/json/SchemaBackedJsonDBAdapter.js';
import { GlobalOptions } from '@/globals.js';
import { inject, injectable } from 'inversify';
import { isUndefined } from 'lodash-es';
import { Low } from 'lowdb';
import { join } from 'node:path';
import { z } from 'zod/v4';
import {
  StreamLineupItem,
  isCommercialLineupItem,
} from '../db/derived_types/StreamLineup.ts';
import { IStreamLineupCache } from '../interfaces/IStreamLineupCache.ts';
import { KEYS } from '../types/inject.ts';
import { Logger } from '../util/logging/LoggerFactory.ts';

const channelCacheSchema = z.object({
  fillerPlayTimeCache: z.record(z.string(), z.number()).default({}),
  programPlayTimeCache: z.record(z.string(), z.number()).default({}),
  version: z.number().optional(),
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
        fillerPlayTimeCache: {},
        programPlayTimeCache: {},
      },
    );
  }

  async init() {
    return this.#db.read();
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
    @inject(KEYS.Logger) private logger: Logger,
  ) {}

  getCurrentLineupItem(): StreamLineupItem | undefined {
    // TODO: Remove this entirely. Just return undefined for now since this is essentially
    // useless.
    return;
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
      const key = this.getKey(channelId, lineupItem.program.uuid);
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
    try {
      await this.recordProgramPlayTime(channelId, lineupItem, t0);
      // await this.persistentChannelCache.setStreamPlayItem(channelId, {
      //   timestamp: t0,
      //   lineupItem: lineupItem,
      // });
    } catch (e) {
      this.logger.warn(
        e,
        'Error while setting stream cache for lineup item: %O at %d',
        lineupItem,
        t0,
      );
    }
  }

  async clearPlayback() {
    // return await this.persistentChannelCache.clearStreamPlayItem(channelId);
  }

  // Is this necessary??
  clear() {
    // this.configCache = {};
    // this.cache = {};
    // this.channelNumbers = undefined;
  }
}
