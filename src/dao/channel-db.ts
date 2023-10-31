import fs from 'fs';
import { isUndefined } from 'lodash-es';
import path from 'path';
import { DeepReadonly } from 'ts-essentials';
import { Maybe } from '../types.js';
import { Channel, DbAccess, ImmutableChannel } from './db.js';

export class ChannelDB {
  private db: DbAccess;
  private folder: string;

  constructor(db: DbAccess) {
    this.db = db;
  }

  getChannel(channelNumber: number): DeepReadonly<Maybe<Channel>> {
    return this.db.channels().getById(channelNumber);
  }

  async saveChannel(channel: Channel) {
    return this.db.channels().insertOrUpdate(channel);
  }

  // TODO: delete this once db-migration is obsolete
  saveChannelSync(number, json) {
    this.validateChannelJson(number, json);

    let data = JSON.stringify(json);
    let f = path.join(this.folder, `${json.number}.json`);
    fs.writeFileSync(f, data);
  }

  validateChannelJson(number, json) {
    json.number = number;
    if (isUndefined(json.number)) {
      throw Error('Expected a channel.number');
    }
    if (typeof json.number === 'string') {
      try {
        json.number = parseInt(json.number);
      } catch (err) {
        console.error('Error parsing channel number.', err);
      }
    }
    if (isNaN(json.number)) {
      throw Error('channel.number must be a integer');
    }
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
