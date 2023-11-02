import { compact, isUndefined } from 'lodash-es';
import constants from './constants.js';
import { ChannelDB } from './dao/channel-db.js';
import { Channel, ImmutableChannel } from './dao/db.js';
import { LineupItem, Maybe } from './types.js';

const SLACK = constants.SLACK;

export class ChannelCache {
  private cache: Record<number, { t0: number; lineupItem: LineupItem }> = {};
  private configCache: Record<number, ImmutableChannel> = {};
  private fillerPlayTimeCache = {};
  private programPlayTimeCache = {};
  private channelNumbers: Maybe<number[]>;
  private channelDb: ChannelDB;

  constructor(channelDb: ChannelDB) {
    this.channelDb = channelDb;
  }

  async getChannelConfig(channelId: number): Promise<Maybe<ImmutableChannel>> {
    //with lazy-loading
    if (isUndefined(this.configCache[channelId])) {
      let channel = this.channelDb.getChannel(channelId);
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
      this.channelNumbers = this.channelDb.getAllChannelNumbers();
    }
    return this.channelNumbers;
  }

  getCurrentLineupItem(channelId: number, t1: number): LineupItem | undefined {
    if (isUndefined(this.cache[channelId])) {
      return;
    }
    let recorded = this.cache[channelId];
    let lineupItem = { ...recorded.lineupItem };
    let diff = t1 - recorded.t0;
    let rem = lineupItem.duration - lineupItem.start;
    if (!isUndefined(lineupItem.streamDuration)) {
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
        return;
      }
    }
    if (lineupItem.start + SLACK > lineupItem.duration) {
      return;
    }
    return lineupItem;
  }

  saveChannelConfig(number: number, channel: Channel) {
    this.configCache[number] = channel;
  }

  getKey(channelId: number, program) {
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

  private getFillerKey(channelId: number, fillerId: string) {
    return channelId + '|' + fillerId;
  }

  private recordProgramPlayTime(channelId: number, lineupItem, t0: number) {
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

  getProgramLastPlayTime(channelId: number, program) {
    let v = this.programPlayTimeCache[this.getKey(channelId, program)];
    if (isUndefined(v)) {
      return 0;
    } else {
      return v;
    }
  }

  getFillerLastPlayTime(channelId: number, fillerId) {
    let v = this.fillerPlayTimeCache[this.getFillerKey(channelId, fillerId)];
    if (isUndefined(v)) {
      return 0;
    } else {
      return v;
    }
  }

  recordPlayback(channelId: number, t0: number, lineupItem: LineupItem) {
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
