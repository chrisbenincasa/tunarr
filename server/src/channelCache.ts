import constants from '@tunarr/shared/constants';
import { isNil, isNumber, isUndefined } from 'lodash-es';
import { ChannelDB } from './dao/channelDb.js';
import {
  StreamLineupItem,
  isCommercialLineupItem,
} from './dao/derived_types/StreamLineup.js';
import { Channel } from './dao/entities/Channel.js';
import { FillerShowId } from './dao/entities/FillerShow.js';
import { Nullable } from './types.js';

const SLACK = constants.SLACK;

// All instances share the same maps.
// TODO: This will eventually use a persistent store
const streamPlayCache: Record<
  string,
  { t0: number; lineupItem: StreamLineupItem }
> = {};
const fillerPlayTimeCache: Record<string, number> = {};
const programPlayTimeCache: Record<string, number> = {};

export class ChannelCache {
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
    channelId: string,
    timeNow: number,
  ): StreamLineupItem | undefined {
    if (isUndefined(streamPlayCache[channelId])) {
      return;
    }
    const recorded = streamPlayCache[channelId];
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
    if ((lineupItem.start ?? 0) + SLACK > lineupItem.duration) {
      return;
    }
    return lineupItem;
  }

  private getKey(channelId: string, programId: string) {
    // let serverKey = '!unknown!';
    // if (!isUndefined(program.serverKey)) {
    //   serverKey = 'plex|' + program.serverKey;
    // }
    // let programKey = '!unknownProgram!';
    // if (!isUndefined(program.key)) {
    //   programKey = program.key;
    // }
    // return channelId + '|' + serverKey + '|' + programKey;
    return `${channelId}|${programId}`;
  }

  private getFillerKey(channelId: string, fillerId: string) {
    return channelId + '|' + fillerId;
  }

  private recordProgramPlayTime(
    channelId: string,
    lineupItem: StreamLineupItem,
    t0: number,
  ) {
    let remaining: number;
    if (!isUndefined(lineupItem.streamDuration)) {
      remaining = lineupItem.streamDuration;
    } else {
      remaining = lineupItem.duration - (lineupItem.start ?? 0);
    }

    if (lineupItem.type === 'program') {
      const key = this.getKey(channelId, lineupItem.programId);
      programPlayTimeCache[key] = t0 + remaining;
    }

    if (isCommercialLineupItem(lineupItem)) {
      fillerPlayTimeCache[this.getFillerKey(channelId, lineupItem.programId)] =
        t0 + remaining;
    }
  }

  getProgramLastPlayTime(channelId: string, programId: string) {
    const v = programPlayTimeCache[this.getKey(channelId, programId)];
    if (isUndefined(v)) {
      return 0;
    } else {
      return v;
    }
  }

  getFillerLastPlayTime(channelId: string, fillerId: FillerShowId) {
    const v = fillerPlayTimeCache[this.getFillerKey(channelId, fillerId)];
    if (isUndefined(v)) {
      return 0;
    } else {
      return v;
    }
  }

  recordPlayback(channelId: string, t0: number, lineupItem: StreamLineupItem) {
    this.recordProgramPlayTime(channelId, lineupItem, t0);

    streamPlayCache[channelId] = {
      t0: t0,
      lineupItem: lineupItem,
    };
  }

  clearPlayback(channelId: string) {
    delete streamPlayCache[channelId];
  }

  clear() {
    //it's not necessary to clear the playback cache and it may be undesirable
    // this.configCache = {};
    // this.cache = {};
    // this.channelNumbers = undefined;
  }
}
