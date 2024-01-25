import { Loaded } from '@mikro-orm/core';
import { CreateFillerListRequest } from '@tunarr/types/api';
import { map } from 'lodash-es';
import { ChannelCache } from '../channelCache.js';
import { Nullable } from '../types.js';
import { getEm } from './dataSource.js';
import { Channel as ChannelEntity } from './entities/Channel.js';
import { ChannelFillerShow } from './entities/ChannelFillerShow.js';
import { FillerShow } from './entities/FillerShow.js';

export class FillerDB {
  private channelCache: ChannelCache;

  constructor(channelCache: ChannelCache) {
    this.channelCache = channelCache;
  }

  getFiller(id: string): Promise<Nullable<FillerShow>> {
    return getEm().repo(FillerShow).findOne(id);
  }

  async saveFiller(filler: FillerShow): Promise<void> {
    const programIds = filler.content?.map((program) => program.uuid) ?? [];
    const em = getEm();
    await em.repo(FillerShow).upsert({
      uuid: filler.uuid,
      name: filler.name,
      content: programIds,
    });
  }

  async createFiller(request: CreateFillerListRequest): Promise<string> {
    const em = getEm();

    const filler = em.create(FillerShow, {
      name: request.name,
    });

    // TODO save programs - requires DB migration

    await em.persistAndFlush(filler);

    return filler.uuid;
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
    // const channels = await this.getFillerChannels(id);

    const em = getEm();
    // await em.nativeDelete(ChannelFillerShow, {fillerShow: id});

    // Remove references to filler collection.
    // await sequentialPromises(channels, undefined, async (channel) => {
    //   logger.debug(`Updating channel ${channel.number}, remove filler ${id}`);
    //   const fullChannel = await this.channelDB.getChannel(channel.number);
    //   await fullChannel?.fillers.init();

    //   if (!isNil(fullChannel) && !isEmpty(fullChannel.fillers)) {
    //     fullChannel.fillers.remove((filler) => filler.uuid === id);
    //     return this.channelDB.saveChannel(fullChannel);
    //   }

    //   return;
    // });

    await em.removeAndFlush(em.getReference(FillerShow, id));
    this.channelCache.clear();
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
