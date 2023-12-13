import { QueryOrder } from '@mikro-orm/core';
import { Nullable } from '../types.js';
import { getEm } from './dataSource.js';
import { Channel } from './entities/Channel.js';

export class ChannelDB {
  getChannel(channelNumber: number): Promise<Nullable<Channel>> {
    return getEm().repo(Channel).findOne({ number: channelNumber });
  }

  async saveChannel(channel: Channel) {
    const em = getEm();
    await em.repo(Channel).upsert(channel);
    await em.flush();
  }

  async updateChannel(id: string, channel: Omit<Partial<Channel>, 'uuid'>) {
    const em = getEm();
    await em.nativeUpdate(Channel, { uuid: id }, channel);
    await em.flush();
  }

  async deleteChannel(channelNumber: number) {
    const em = getEm();
    await em.repo(Channel).nativeDelete({ number: channelNumber });
    await em.flush();
  }

  async getAllChannelNumbers() {
    const channels = await getEm()
      .repo(Channel)
      .findAll({ fields: ['number'], orderBy: { number: QueryOrder.DESC } });
    return channels.map((channel) => channel.number);
  }

  async getAllChannels() {
    return getEm().repo(Channel).findAll();
  }
}
