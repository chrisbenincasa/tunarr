import constants from '@tunarr/shared/constants';
import { isNil, isNumber, isUndefined } from 'lodash-es';
import { ChannelDB } from './dao/channelDb.js';
import {
  StreamLineupItem,
  isCommercialLineupItem,
  isPlexBackedLineupItem,
} from './dao/derived_types/StreamLineup.js';
import { Channel } from './dao/entities/Channel.js';
import { Nullable } from './types.js';

const SLACK = constants.SLACK;

export class ChannelCache {
  private cache: Record<number, { t0: number; lineupItem: StreamLineupItem }> =
    {};
  private fillerPlayTimeCache: Record<string, number> = {};
  private programPlayTimeCache: Record<string, number> = {};
  private channelDb: ChannelDB;

  constructor(channelDb: ChannelDB) {
    this.channelDb = channelDb;
  }

  getChannelConfig(channelId: string | number): Promise<Nullable<Channel>> {
    return isNumber(channelId)
      ? this.channelDb.getChannelByNumber(channelId)
      : this.channelDb.getChannelById(channelId);
  }

  getChannelConfigWithPrograms(channelId: string) {
    return this.channelDb.getChannelAndPrograms(channelId);
  }

  getChannelConfigWithProgramsByNumber(channelNumber: number) {
    return this.channelDb.getChannelAndProgramsByNumber(channelNumber);
  }

  getAllChannels() {
    return this.channelDb.getAllChannels();
  }

  getAllChannelsWithPrograms() {
    return this.channelDb.getAllChannelsAndPrograms();
  }

  getAllNumbers() {
    return this.channelDb.getAllChannelNumbers();
  }

  getCurrentLineupItem(
    channelId: number,
    timeNow: number,
  ): StreamLineupItem | undefined {
    if (isUndefined(this.cache[channelId])) {
      return;
    }
    const recorded = this.cache[channelId];
    const lineupItem = { ...recorded.lineupItem };
    const timeSinceRecorded = timeNow - recorded.t0;
    let remainingTime = lineupItem.duration - (lineupItem.start ?? 0);
    if (!isUndefined(lineupItem.streamDuration)) {
      remainingTime = Math.min(remainingTime, lineupItem.streamDuration);
    }

    if (
      timeSinceRecorded <= SLACK &&
      timeSinceRecorded + SLACK < remainingTime
    ) {
      //closed the stream and opened it again let's not lose seconds for
      //no reason
      const originalT0 = recorded.lineupItem.originalT0 ?? recorded.t0;
      if (timeNow - originalT0 <= SLACK) {
        lineupItem.originalT0 = originalT0;
        return lineupItem;
      }
    }

    lineupItem.start
      ? (lineupItem.start += timeSinceRecorded)
      : timeSinceRecorded;
    if (!isNil(lineupItem.streamDuration)) {
      lineupItem.streamDuration -= timeSinceRecorded;
      if (lineupItem.streamDuration < SLACK) {
        //let's not waste time playing some loose seconds
        return;
      }
    }
    if (lineupItem.start ?? 0 + SLACK > lineupItem.duration) {
      return;
    }
    return lineupItem;
  }

  getKey(channelId: number, program: { serverKey?: string; key?: string }) {
    let serverKey = '!unknown!';
    if (!isUndefined(program.serverKey)) {
      serverKey = 'plex|' + program.serverKey;
    }
    let programKey = '!unknownProgram!';
    if (!isUndefined(program.key)) {
      programKey = program.key;
    }
    return channelId + '|' + serverKey + '|' + programKey;
  }

  private getFillerKey(channelId: number, fillerId: string) {
    return channelId + '|' + fillerId;
  }

  private recordProgramPlayTime(
    channelId: number,
    lineupItem: StreamLineupItem,
    t0: number,
  ) {
    let remaining: number;
    if (typeof lineupItem.streamDuration !== 'undefined') {
      remaining = lineupItem.streamDuration;
    } else {
      remaining = lineupItem.duration - (lineupItem.start ?? 0);
    }
    const key = this.getKey(channelId, {
      serverKey: isPlexBackedLineupItem(lineupItem)
        ? lineupItem.serverKey
        : undefined,
      key: isPlexBackedLineupItem(lineupItem) ? lineupItem.key : undefined,
    });
    this.programPlayTimeCache[key] = t0 + remaining;
    if (isCommercialLineupItem(lineupItem)) {
      this.fillerPlayTimeCache[
        this.getFillerKey(channelId, lineupItem.fillerId)
      ] = t0 + remaining;
    }
  }

  getProgramLastPlayTime(
    channelId: number,
    program: { serverKey?: string; key?: string },
  ) {
    const v = this.programPlayTimeCache[this.getKey(channelId, program)];
    if (isUndefined(v)) {
      return 0;
    } else {
      return v;
    }
  }

  getFillerLastPlayTime(channelId: number, fillerId: string) {
    const v = this.fillerPlayTimeCache[this.getFillerKey(channelId, fillerId)];
    if (isUndefined(v)) {
      return 0;
    } else {
      return v;
    }
  }

  recordPlayback(channelId: number, t0: number, lineupItem: StreamLineupItem) {
    this.recordProgramPlayTime(channelId, lineupItem, t0);

    this.cache[channelId] = {
      t0: t0,
      lineupItem: lineupItem,
    };
  }

  clearPlayback(channelId: number) {
    delete this.cache[channelId];
  }

  clear() {
    //it's not necessary to clear the playback cache and it may be undesirable
    // this.configCache = {};
    // this.cache = {};
    // this.channelNumbers = undefined;
  }
}
