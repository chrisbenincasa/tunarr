import { compact, isUndefined } from 'lodash-es';
import constants from './constants.js';
import { ChannelDB } from './dao/channel-db.js';
import { Channel } from './dao/db.js';
import { Maybe } from './types.js';

const SLACK = constants.SLACK;

// let cache = {};
// let programPlayTimeCache = {};
// let fillerPlayTimeCache = {};
// let configCache = {};
// let numbers = null;

export class ChannelCache {
  private cache = {};
  private configCache: Record<number, Channel> = {};
  private fillerPlayTimeCache = {};
  private programPlayTimeCache = {};
  private channelNumbers: Maybe<number[]>;
  private channelDb: ChannelDB;

  constructor(channelDb: ChannelDB) {
    this.channelDb = channelDb;
  }

  async getChannelConfig(channelId: number): Promise<Maybe<Channel>> {
    //with lazy-loading
    if (isUndefined(this.configCache[channelId])) {
      let channel = await this.channelDb.getChannel(channelId);
      if (!isUndefined(channel)) {
        this.configCache[channelId] = channel;
      }
    }
    return this.configCache[channelId];
  }

  async getAllChannels() {
    const channelNumbers = await this.getAllNumbers();
    const allChannels = await Promise.all(
      channelNumbers.map(async (x) => {
        return this.getChannelConfig(x);
      }),
    );
    return compact(allChannels);
  }

  async getAllNumbers() {
    if (isUndefined(this.channelNumbers)) {
      this.channelNumbers = await this.channelDb.getAllChannelNumbers();
    }
    return this.channelNumbers;
  }

  getCurrentLineupItem(channelId, t1) {
    if (isUndefined(this.cache[channelId])) {
      return null;
    }
    let recorded = this.cache[channelId];
    let lineupItem = JSON.parse(JSON.stringify(recorded.lineupItem));
    let diff = t1 - recorded.t0;
    let rem = lineupItem.duration - lineupItem.start;
    if (typeof lineupItem.streamDuration !== 'undefined') {
      rem = Math.min(rem, lineupItem.streamDuration);
    }
    if (diff <= SLACK && diff + SLACK < rem) {
      //closed the stream and opened it again let's not lose seconds for
      //no reason
      let originalT0 = recorded.lineupItem.originalT0;
      if (isUndefined(originalT0)) {
        originalT0 = recorded.t0;
      }
      if (t1 - originalT0 <= SLACK) {
        lineupItem.originalT0 = originalT0;
        return lineupItem;
      }
    }

    lineupItem.start += diff;
    if (typeof lineupItem.streamDuration !== 'undefined') {
      lineupItem.streamDuration -= diff;
      if (lineupItem.streamDuration < SLACK) {
        //let's not waste time playing some loose seconds
        return null;
      }
    }
    if (lineupItem.start + SLACK > lineupItem.duration) {
      return null;
    }
    return lineupItem;
  }

  saveChannelConfig(number: number, channel: Channel) {
    this.configCache[number] = channel;
  }

  getKey(channelId, program) {
    let serverKey = '!unknown!';
    if (typeof program.serverKey !== 'undefined') {
      if (typeof program.serverKey !== 'undefined') {
        serverKey = 'plex|' + program.serverKey;
      }
    }
    let programKey = '!unknownProgram!';
    if (typeof program.key !== 'undefined') {
      programKey = program.key;
    }
    return channelId + '|' + serverKey + '|' + programKey;
  }

  private getFillerKey(channelId, fillerId) {
    return channelId + '|' + fillerId;
  }

  private recordProgramPlayTime(channelId, lineupItem, t0) {
    let remaining;
    if (typeof lineupItem.streamDuration !== 'undefined') {
      remaining = lineupItem.streamDuration;
    } else {
      remaining = lineupItem.duration - lineupItem.start;
    }
    this.programPlayTimeCache[this.getKey(channelId, lineupItem)] =
      t0 + remaining;
    if (typeof lineupItem.fillerId !== 'undefined') {
      this.fillerPlayTimeCache[
        this.getFillerKey(channelId, lineupItem.fillerId)
      ] = t0 + remaining;
    }
  }

  getProgramLastPlayTime(channelId, program) {
    let v = this.programPlayTimeCache[this.getKey(channelId, program)];
    if (isUndefined(v)) {
      return 0;
    } else {
      return v;
    }
  }

  getFillerLastPlayTime(channelId, fillerId) {
    let v = this.fillerPlayTimeCache[this.getFillerKey(channelId, fillerId)];
    if (isUndefined(v)) {
      return 0;
    } else {
      return v;
    }
  }

  recordPlayback(channelId, t0, lineupItem) {
    this.recordProgramPlayTime(channelId, lineupItem, t0);

    this.cache[channelId] = {
      t0: t0,
      lineupItem: lineupItem,
    };
  }

  clearPlayback(channelId) {
    delete this.cache[channelId];
  }

  clear() {
    //it's not necessary to clear the playback cache and it may be undesirable
    this.configCache = {};
    this.cache = {};
    this.channelNumbers = undefined;
  }
}
