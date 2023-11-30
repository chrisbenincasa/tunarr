import { DeepReadonly } from 'ts-essentials';
import { Maybe } from '../types.js';
import { DbAccess, ImmutableChannel } from './db.js';
import { Channel } from 'dizquetv-types';

export class ChannelDB {
  private db: DbAccess;

  constructor(db: DbAccess) {
    this.db = db;
  }

  getChannel(channelNumber: number): DeepReadonly<Maybe<Channel>> {
    return this.db.channels().getById(channelNumber);
  }

  async saveChannel(channel: Channel) {
    return this.db.channels().insertOrUpdate(channel);
  }

  async deleteChannel(channelNumber: number) {
    return this.db.channels().delete(channelNumber);
  }

  getAllChannelNumbers(): number[] {
    return this.db
      .channels()
      .getAll()
      .map((channel) => channel.number)
      .sort();
  }

  getAllChannels(): ReadonlyArray<ImmutableChannel> {
    return [...this.db.channels().getAll()];
  }
}
