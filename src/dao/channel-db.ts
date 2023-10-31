import fs from 'fs';
import { isUndefined } from 'lodash-es';
import path from 'path';
import { Channel, DbAccess } from './db.js';

export class ChannelDB {
  private db: DbAccess;
  private folder: string;

  constructor(db: DbAccess) {
    this.db = db;
  }

  async getChannel(channelNumber: number) {
    return this.db
      .channels()
      .find((channel) => channel.number === channelNumber);
  }

  async saveChannel(channel: Channel) {
    return this.db.upsertChannel(channel);
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
    return this.db.deleteChannel(channelNumber);
  }

  async getAllChannelNumbers(): Promise<number[]> {
    return this.db
      .channels()
      .map((channel) => channel.number)
      .sort();
  }

  async getAllChannels(): Promise<any[]> {
    let numbers = await this.getAllChannelNumbers();
    return await Promise.all(numbers.map(async (c) => this.getChannel(c)));
  }
}
