import { isEmpty, isUndefined, map, remove, some } from 'lodash-es';
import { DeepReadonly, MarkOptional, Writable } from 'ts-essentials';
import { v4 as uuidv4 } from 'uuid';
import { ChannelCache } from '../channelCache.js';
import createLogger from '../logger.js';
import { Maybe } from '../types.js';
import { sequentialPromises } from '../util.js';
import { ChannelDB } from './channelDb.js';
import {
  Channel,
  DbAccess,
  FillerCollection,
  FillerList,
  FillerProgram,
  Program,
} from './db.js';

const logger = createLogger(import.meta);

export type FillerUpdate = MarkOptional<FillerList, 'content'>;
export type FillerCreate = MarkOptional<
  Omit<FillerList, 'id'>,
  'content' | 'name'
>;

export class FillerDB {
  private cache: Record<string, Maybe<DeepReadonly<FillerList>>>;
  private channelDB: ChannelDB;
  private channelCache: ChannelCache;
  private dbAccess: DbAccess;

  constructor(
    channelDB: ChannelDB,
    channelCache: ChannelCache,
    dbAccess: DbAccess,
  ) {
    this.cache = {};
    this.channelDB = channelDB;
    this.channelCache = channelCache;
    this.dbAccess = dbAccess;
  }

  // TODO Is cache necessary if we always have the DB in memory?
  getFiller(id: string): Maybe<DeepReadonly<FillerList>> {
    if (isUndefined(this.cache[id])) {
      this.cache[id] = this.dbAccess.fillerLists().getById(id);
    }
    return this.cache[id];
  }

  async saveFiller(id: Maybe<string>, fillerList: FillerUpdate): Promise<void> {
    if (isUndefined(id)) {
      throw Error('Mising filler id');
    }

    const actualFiller: FillerList = {
      ...fillerList,
      content: fillerList.content ?? [],
      id,
    };

    try {
      return this.dbAccess.fillerLists().insertOrUpdate(actualFiller);
    } finally {
      delete this.cache[id];
    }
  }

  async createFiller(fillerList: FillerCreate): Promise<string> {
    const id = uuidv4();

    const actualFiller: FillerList = {
      id,
      content: fillerList.content ?? [],
      name: fillerList.name ?? 'Unnamed Filler',
    };

    await this.saveFiller(id, actualFiller);

    return id;
  }

  // Returns all channels a given filler list is a part of
  getFillerChannels(id: string): { name: string; number: number }[] {
    const fillerChannels: { name: string; number: number }[] = [];
    this.channelDB.getAllChannels().forEach((channel) => {
      if (some(channel.fillerCollections ?? [], { id })) {
        fillerChannels.push({ number: channel.number, name: channel.name });
      }
    });
    return fillerChannels;
  }

  async deleteFiller(id: string): Promise<void> {
    const channels = this.getFillerChannels(id);

    // Remove references to filler collection.
    await sequentialPromises(channels, undefined, async (channel) => {
      logger.debug(`Updating channel ${channel.number}, remove filler ${id}`);
      const fullChannel = this.channelDB.getChannel(channel.number);
      if (
        !isUndefined(fullChannel) &&
        !isEmpty(fullChannel.fillerCollections)
      ) {
        const newChannel: Channel = {
          ...(fullChannel as Writable<Channel>),
          fillerCollections: remove(fullChannel.fillerCollections ?? [], {
            id,
          }),
        };
        return this.channelDB.saveChannel(newChannel);
      }

      return void 0;
    });

    this.channelCache.clear();

    return this.dbAccess.fillerLists().delete(id);
  }

  getAllFillerIds(): string[] {
    return map(this.getAllFillers(), 'id');
  }

  getAllFillers(): DeepReadonly<FillerList[]> {
    return this.dbAccess.fillerLists().getAll();
  }

  getAllFillersInfo() {
    //returns just name and id
    const fillers = this.getAllFillers();
    return fillers.map((f) => {
      return {
        id: f.id,
        name: f.name,
        count: f.content.length,
      };
    });
  }

  getFillersFromChannel(
    channel: Channel,
  ): (FillerCollection & { content: Program[] })[] {
    // TODO nasty return type, fix.
    const loadChannelFiller = (fillerEntry: FillerCollection) => {
      let content: FillerProgram[] = [];
      try {
        const filler = this.getFiller(fillerEntry.id);
        content = [...(filler?.content ?? [])];
      } catch (e) {
        logger.error(
          `Channel #${channel.number} - ${channel.name} references an unattainable filler id: ${fillerEntry.id}`,
          e,
        );
      }
      return {
        id: fillerEntry.id,
        content: content,
        weight: fillerEntry.weight,
        cooldownSeconds: fillerEntry.cooldownSeconds,
      };
    };

    return (channel.fillerCollections ?? []).map(loadChannelFiller);
  }
}
