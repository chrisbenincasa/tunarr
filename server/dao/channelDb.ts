import { QueryOrder } from '@mikro-orm/core';
import { Low } from 'lowdb';
import { JSONPreset } from 'lowdb/node';
import { join } from 'path';
import { globalOptions } from '../globals.js';
import { Nullable } from '../types.js';
import { getEm } from './dataSource.js';
import { Lineup } from './derived_types/Lineup.js';
import { Channel } from './entities/Channel.js';

export class ChannelDB {
  private fileDbCache: Record<number, Low<Lineup>> = {};

  getChannel(channelNumber: number): Promise<Nullable<Channel>> {
    return getEm().repo(Channel).findOne({ number: channelNumber });
  }

  getChannelAndPrograms(number: number) {
    return getEm()
      .repo(Channel)
      .findOne({ number }, { populate: ['programs'] });
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

  async getAllChannelsAndPrograms() {
    return getEm()
      .repo(Channel)
      .findAll({ populate: ['programs'] });
  }

  async loadLineup(channelNumber: number) {
    const db = await this.getFileDb(channelNumber);
    return db.data;
  }

  private async getFileDb(channel: number) {
    if (!this.fileDbCache[channel]) {
      this.fileDbCache[channel] = await JSONPreset<Lineup>(
        join(globalOptions().database, `channel-lineups/${channel}.json`),
        { items: [] },
      );
      await this.fileDbCache[channel].read();
    }

    return this.fileDbCache[channel];
  }
}
