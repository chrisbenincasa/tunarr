import { Loaded } from '@mikro-orm/core';
import { isEmpty, isNil, map } from 'lodash-es';
import { MarkOptional } from 'ts-essentials';
import { v4 as uuidv4 } from 'uuid';
import { ChannelCache } from '../channelCache.js';
import createLogger from '../logger.js';
import { Maybe, Nullable } from '../types.js';
import { sequentialPromises } from '../util.js';
import { ChannelDB } from './channelDb.js';
import { getEm } from './dataSource.js';
import { FillerList } from './db.js';
import { Channel as ChannelEntity } from './entities/Channel.js';
import { ChannelFillerShow } from './entities/ChannelFillerShow.js';
import { FillerShow } from './entities/FillerShow.js';

const logger = createLogger(import.meta);

export type FillerUpdate = MarkOptional<FillerList, 'content'>;
export type FillerCreate = MarkOptional<
  Omit<FillerList, 'id'>,
  'content' | 'name'
>;

export class FillerDB {
  private channelDB: ChannelDB;
  private channelCache: ChannelCache;

  constructor(channelDB: ChannelDB, channelCache: ChannelCache) {
    this.channelDB = channelDB;
    this.channelCache = channelCache;
  }

  // TODO Is cache necessary if we always have the DB in memory?
  getFiller(id: string): Promise<Nullable<FillerShow>> {
    return getEm().repo(FillerShow).findOne(id);
  }

  async saveFiller(id: Maybe<string>, fillerList: FillerUpdate): Promise<void> {
    if (isNil(id)) {
      throw Error('Mising filler id');
    }

    // const actualFiller: FillerShow = {
    //   ...fillerList,
    //   content: fillerList.content ?? [],
    //   uuid: id,
    // };

    const programIds = fillerList.content?.map((program) => program.id) ?? [];
    const em = getEm();
    await em.repo(FillerShow).upsert({
      uuid: id,
      name: fillerList.name,
      content: programIds,
    });

    // try {
    //   return this.dbAccess.fillerLists().insertOrUpdate(actualFiller);
    // } finally {
    //   delete this.cache[id];
    // }
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
  async getFillerChannels(id: string) {
    const channels = await getEm()
      .createQueryBuilder(ChannelEntity, 'channel')
      .select(['number', 'name'], true)
      .where({ fillers: { uuid: id } })
      .execute();
    return channels.map((channel) => ({
      name: channel.name,
      number: channel.number,
    }));
  }

  async deleteFiller(id: string): Promise<void> {
    const channels = await this.getFillerChannels(id);

    // Remove references to filler collection.
    await sequentialPromises(channels, undefined, async (channel) => {
      logger.debug(`Updating channel ${channel.number}, remove filler ${id}`);
      const fullChannel = await this.channelDB.getChannel(channel.number);
      await fullChannel?.fillers.init();

      if (!isNil(fullChannel) && !isEmpty(fullChannel.fillers)) {
        fullChannel.fillers.remove((filler) => filler.uuid === id);
        return this.channelDB.saveChannel(fullChannel);
      }

      return;
    });

    this.channelCache.clear();

    const em = getEm();
    await em.removeAndFlush(em.getReference(FillerShow, id));
    return;
  }

  getAllFillerIds() {
    return getEm()
      .repo(FillerShow)
      .findAll({ fields: ['uuid'] })
      .then((shows) => map(shows, 'uuid'));
  }

  getAllFillers(): Promise<FillerShow[]> {
    return getEm().repo(FillerShow).findAll();
  }

  async getAllFillersInfo() {
    //returns just name and id
    const fillers = await getEm()
      .repo(FillerShow)
      .findAll({ fields: ['uuid', 'name'], populate: ['content'] });
    // getEm().createQueryBuilder(FillerShow).count().where({
    //   content: {},
    // });
    // const fillers = await this.getAllFillers();
    return fillers.map((f) => {
      return {
        id: f.uuid,
        name: f.name,
        count: f.content.length,
      };
    });
  }

  async getFillersFromChannel(
    channelNumber: number,
  ): Promise<Loaded<ChannelFillerShow, 'fillerShow' | 'fillerShow.content'>[]> {
    const em = getEm();
    return await em.find(
      ChannelFillerShow,
      {
        channel: { number: channelNumber },
      },
      { populate: ['fillerShow', 'fillerShow.content'] },
    );
  }
}
