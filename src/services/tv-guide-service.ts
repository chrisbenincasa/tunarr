import { compact, isEmpty, isString, isUndefined, keys, map } from 'lodash-es';
import constants from '../constants.js';
import {
  Channel,
  ChannelIcon,
  ImmutableChannel,
  Program,
  getDB,
} from '../dao/db.js';
import createLogger from '../logger.js';
import { Maybe } from '../types.js';
import { groupByUniq, groupByUniqAndMap } from '../util.js';
import { XmlTvWriter } from '../xmltv.js';
import { CacheImageService } from './cache-image-service.js';
import { EventService } from './event-service.js';
import throttle from './throttle.js';

const logger = createLogger(import.meta);

const FALLBACK_ICON =
  'https://raw.githubusercontent.com/vexorain/dizquetv/main/resources/dizquetv.png';

type CurrentPlayingProgram = {
  programIndex?: number;
  startTimeMs: number;
  program: Partial<Program>;
};

type TvGuideProgramSubtitle = {
  season?: number;
  episode?: number;
  title?: string;
};

type TvGuideProgram = {
  start: string;
  stop: string;
  summary?: string;
  date?: string;
  rating?: string;
  icon?: string;
  title: string;
  sub?: TvGuideProgramSubtitle;
};

type ChannelPrograms = {
  channel: Partial<Channel>;
  programs: TvGuideProgram[];
};

export type ChannelLineup = {
  icon?: ChannelIcon;
  name?: string;
  number?: number;
  programs: TvGuideProgram[];
};

export class TVGuideService {
  cached: Record<number, ChannelPrograms>;
  lastUpdate: number;
  lastBackoff: number;
  updateTime: number;
  currentUpdate: number;
  currentLimit: number;
  currentChannels: Channel[];
  xmltv: XmlTvWriter;
  cacheImageService: any;
  eventService: EventService;
  _throttle: () => Promise<void>;
  updateLimit: any;
  updateChannels: any[];
  accumulateTable: Record<number, any> = {};
  channelsByNumber: Record<number, Channel>;
  /****
   *
   **/
  constructor(
    xmltv: XmlTvWriter,
    cacheImageService: CacheImageService,
    eventService: EventService,
  ) {
    this.cached = {};
    this.lastUpdate = 0;
    this.lastBackoff = 100;
    this.updateTime = 0;
    this.currentUpdate = -1;
    this.currentLimit = -1;
    this.currentChannels = [];
    this.xmltv = xmltv;
    this.cacheImageService = cacheImageService;
    this.eventService = eventService;
    this._throttle = throttle;
  }

  async get() {
    while (this.cached == null) {
      await _wait(100);
    }

    return this.cached;
  }

  prepareRefresh(inputChannels: ImmutableChannel[], limit: number) {
    let t = new Date().getTime();
    this.updateTime = t;
    this.updateLimit = t + limit;

    this.updateChannels = compact(inputChannels);
    if (inputChannels.length !== this.updateChannels.length) {
      logger.error(
        `There is an issue with one or more of the channels provided to TV-guide service, it will be ignored`,
      );
    }
    return t;
  }

  async refresh(t: number) {
    while (this.lastUpdate < t) {
      if (this.currentUpdate == -1) {
        this.currentUpdate = this.updateTime;
        this.currentLimit = this.updateLimit;
        this.currentChannels = this.updateChannels;
        this.eventService.push('xmltv', {
          message: `Started building tv-guide at = ${new Date()}`,
          module: 'xmltv',
          detail: {
            time: new Date(),
          },
          level: 'info',
        });

        await this.buildIt();
      }
      await _wait(100);
    }
    return await this.get();
  }

  // Returns duration offsets for programs on a channel in an array
  async makeAccumulated(channel: Channel) {
    if (isUndefined(channel.programs)) {
      throw Error(JSON.stringify(channel).slice(0, 200));
    }
    let n = channel.programs.length;
    let arr = new Array(channel.programs.length + 1);
    arr[0] = 0;
    for (let i = 0; i < n; i++) {
      arr[i + 1] = arr[i] + channel.programs[i].duration;
      // await this._throttle();
    }
    return arr;
  }

  async getCurrentPlayingIndex(
    channel: Channel,
    currentUpdateTimeMs: number,
  ): Promise<CurrentPlayingProgram> {
    let channelStartTime = new Date(channel.startTimeEpoch).getTime();
    if (currentUpdateTimeMs < channelStartTime) {
      //it's flex time
      return {
        programIndex: -1,
        startTimeMs: currentUpdateTimeMs,
        program: {
          isOffline: true,
          duration: channelStartTime - currentUpdateTimeMs,
        },
      };
    } else {
      let accumulate = this.accumulateTable[channel.number];
      if (isUndefined(accumulate)) {
        throw Error(channel.number + " wasn't preprocesed correctly???!?");
      }
      let hi = channel.programs.length;
      let lo = 0;
      let d =
        (currentUpdateTimeMs - channelStartTime) %
        accumulate[channel.programs.length];
      let epoch = currentUpdateTimeMs - d;
      // Binary search for the currently playing program
      while (lo + 1 < hi) {
        let ha = Math.floor((lo + hi) / 2);
        if (accumulate[ha] > d) {
          hi = ha;
        } else {
          lo = ha;
        }
      }

      if (epoch + accumulate[lo + 1] <= currentUpdateTimeMs) {
        throw Error('General algorithm error, completely unexpected');
      }

      return {
        programIndex: lo,
        startTimeMs: epoch + accumulate[lo],
        program: channel.programs[lo],
      };
    }
  }

  async getChannelPlaying(
    channel: Channel,
    previousKnown: Maybe<CurrentPlayingProgram>,
    currentUpdateTimeMs: number,
    depth: any[] = [],
  ): Promise<CurrentPlayingProgram> {
    let playing: CurrentPlayingProgram;
    if (
      !isUndefined(previousKnown) &&
      !isUndefined(previousKnown.programIndex) &&
      previousKnown.programIndex !== -1 &&
      previousKnown.program.duration ==
        channel.programs[previousKnown.programIndex].duration &&
      previousKnown.startTimeMs + previousKnown.program.duration ==
        currentUpdateTimeMs
    ) {
      //turns out we know the index.
      let index = (previousKnown.programIndex + 1) % channel.programs.length;
      playing = {
        programIndex: index,
        program: channel.programs[index],
        startTimeMs: currentUpdateTimeMs,
      };
    } else {
      playing = await this.getCurrentPlayingIndex(channel, currentUpdateTimeMs);
    }
    if (playing.program == null || isUndefined(playing)) {
      logger.warn(
        'There is a weird issue with the TV guide generation. A placeholder program is placed to prevent further issues. Please report this.',
      );
      playing = {
        programIndex: -1,
        program: {
          isOffline: true,
          duration: 30 * 60 * 1000,
        },
        startTimeMs: currentUpdateTimeMs,
      };
    }
    if (
      playing.program.isOffline &&
      playing.program.type === 'redirect' &&
      !isUndefined(playing.program.channel)
    ) {
      let ch2 = playing.program.channel;

      if (depth.indexOf(ch2) != -1) {
        logger.error(
          'Redirrect loop found! Involved channels = ' + JSON.stringify(depth),
        );
      } else {
        depth.push(channel.number);
        let channel2 = this.channelsByNumber[ch2];
        if (isUndefined(channel2)) {
          logger.error(
            'Redirrect to an unknown channel found! Involved channels = ' +
              JSON.stringify(depth),
          );
        } else {
          let otherPlaying = await this.getChannelPlaying(
            channel2,
            undefined,
            currentUpdateTimeMs,
            depth,
          );
          let start = Math.max(playing.startTimeMs, otherPlaying.startTimeMs);
          let duration = Math.min(
            playing.startTimeMs + playing.program.duration! - start,
            otherPlaying.startTimeMs +
              (otherPlaying.program.duration ?? 0) -
              start,
          );
          let program2 = clone(otherPlaying.program);
          program2.duration = duration;
          playing = {
            programIndex: playing.programIndex,
            startTimeMs: start,
            program: program2,
          };
        }
      }
    }
    return playing;
  }

  async getChannelPrograms(
    currentUpdateTimeMs: number,
    currentEndTimeMs: number,
    channel: Channel,
  ): Promise<ChannelPrograms> {
    if (isUndefined(channel)) {
      throw Error("Couldn't find channel?");
    }
    let result: ChannelPrograms = {
      channel: makeChannelEntry(channel),
      programs: [],
    };

    let programs: CurrentPlayingProgram[] = [];

    let x = await this.getChannelPlaying(
      channel,
      undefined,
      currentUpdateTimeMs,
    );

    if (x.program.duration == 0) {
      throw Error('A ' + channel.name + ' ' + JSON.stringify(x));
    }

    let melded = 0;

    let push = async (x: CurrentPlayingProgram) => {
      await this._throttle();
      if (
        programs.length > 0 &&
        isProgramFlex(x.program, channel) &&
        ((x.program.duration ?? 0) <=
          constants.TVGUIDE_MAXIMUM_PADDING_LENGTH_MS ||
          isProgramFlex(programs[programs.length - 1].program, channel))
      ) {
        //meld with previous
        let y = clone(programs[programs.length - 1]);
        y.program.duration += x.program.duration;
        melded += x.program.duration ?? 0;
        if (
          melded > constants.TVGUIDE_MAXIMUM_PADDING_LENGTH_MS &&
          !isProgramFlex(programs[programs.length - 1].program, channel)
        ) {
          y.program.duration -= melded;
          programs[programs.length - 1] = y;
          if (y.start + y.program.duration < currentEndTimeMs) {
            programs.push({
              startTimeMs: y.start + y.program.duration,
              program: {
                isOffline: true,
                duration: melded,
              },
            });
          }
          melded = 0;
        } else {
          programs[programs.length - 1] = y;
        }
      } else if (isProgramFlex(x.program, channel)) {
        melded = 0;
        programs.push({
          startTimeMs: x.startTimeMs,
          program: {
            isOffline: true,
            duration: x.program.duration,
          },
        });
      } else {
        melded = 0;
        programs.push(x);
      }
    };
    while (x.startTimeMs < currentEndTimeMs) {
      await push(x);
      let t2 = x.startTimeMs + (x.program.duration ?? 0);
      x = await this.getChannelPlaying(channel, x, t2);
      if (x.startTimeMs < t2) {
        let d = t2 - x.startTimeMs;
        x.startTimeMs = t2;
        x.program = clone(x.program);
        if (x.program.duration) {
          x.program.duration -= d;
        }
      }
      if (x.program.duration == 0) {
        logger.error("There's a program with duration 0?");
      }
    }
    result.programs = [];
    for (let i = 0; i < programs.length; i++) {
      await this._throttle();
      if (isProgramFlex(programs[i].program, channel)) {
        let start = programs[i].startTimeMs;
        let duration = programs[i].program.duration ?? 0;
        if (start <= currentUpdateTimeMs) {
          const M = 5 * 60 * 1000;
          let newStart = currentUpdateTimeMs - (currentUpdateTimeMs % M);
          if (start < newStart) {
            duration -= newStart - start;
            start = newStart;
          }
        }
        while (start < currentEndTimeMs && duration > 0) {
          let d = Math.min(duration, constants.TVGUIDE_MAXIMUM_FLEX_DURATION);
          if (
            duration - constants.TVGUIDE_MAXIMUM_FLEX_DURATION <=
            constants.TVGUIDE_MAXIMUM_PADDING_LENGTH_MS
          ) {
            d = duration;
          }
          let x: CurrentPlayingProgram = {
            startTimeMs: start,
            program: {
              isOffline: true,
              duration: d,
            },
          };
          duration -= d;
          start += d;
          result.programs.push(makeEntry(channel, x));
        }
      } else {
        result.programs.push(makeEntry(channel, programs[i]));
      }
    }

    return result;
  }

  async buildItManaged() {
    let currentUpdateTimeMs = this.currentUpdate;
    let currentEndTimeMs = this.currentLimit;
    let channels = this.currentChannels;
    this.channelsByNumber = groupByUniq(channels, 'number');
    let accumulateTablePromises = groupByUniqAndMap(
      channels,
      'number',
      async (channel) => await this.makeAccumulated(channel),
    );
    for (let channelId in accumulateTablePromises) {
      this.accumulateTable[channelId] =
        await accumulateTablePromises[channelId];
    }

    let result = {};
    if (channels.length == 0) {
      let channel: Partial<Channel> = {
        name: 'dizqueTV',
        icon: {
          path: FALLBACK_ICON,
          width: 0,
          duration: 0,
          position: 'bottom',
        },
      };
      result[1] = {
        channel: channel,
        programs: [
          makeEntry(channel, {
            startTimeMs:
              currentUpdateTimeMs - (currentUpdateTimeMs % (30 * 60 * 1000)),
            program: {
              duration: 24 * 60 * 60 * 1000,
              icon: FALLBACK_ICON,
              showTitle: 'No channels configured',
              date: formatDateYYYYMMDD(new Date()),
              summary: 'Use the dizqueTV web UI to configure channels.',
            },
          }),
        ],
      };
    } else {
      for (let i = 0; i < channels.length; i++) {
        if (!channels[i].stealth) {
          let programs = await this.getChannelPrograms(
            currentUpdateTimeMs,
            currentEndTimeMs,
            channels[i],
          );
          result[channels[i].number] = programs;
        }
      }
    }
    return result;
  }

  async buildIt() {
    try {
      this.cached = await this.buildItManaged();
      logger.info(
        'Internal TV Guide data refreshed at ' + new Date().toLocaleString(),
      );
      await this.refreshXML();
      this.lastBackoff = 100;
    } catch (err) {
      logger.error('Unable to update internal guide data', err);
      let w = Math.min(this.lastBackoff * 2, 300000);
      await _wait(w);
      this.lastBackoff = w;
      logger.error(`Retrying TV guide after ${w} milliseconds wait...`);
      await this.buildIt();
    } finally {
      this.lastUpdate = this.currentUpdate;
      this.currentUpdate = -1;
    }
  }

  async refreshXML() {
    let xmltvSettings = (await getDB()).xmlTvSettings();
    await this.xmltv.WriteXMLTV(
      this.cached,
      xmltvSettings,
      async () => await this._throttle(),
      this.cacheImageService,
    );
    this.eventService.push('xmltv', {
      message: `XMLTV updated at server time = ${new Date()}`,
      module: 'xmltv',
      detail: {
        time: new Date(),
      },
      level: 'info',
    });
  }

  async getStatus() {
    await this.get();
    let channels = map(keys(this.cached), parseInt);

    return {
      lastUpdate: new Date(this.lastUpdate).toISOString(),
      channelNumbers: channels,
    };
  }

  async getChannelLineup(
    channelNumber: number,
    dateFrom: Date,
    dateTo: Date,
  ): Promise<Maybe<ChannelLineup>> {
    await this.get();
    let beginningTimeMs = dateFrom.toISOString();
    let endTimeMs = dateTo.toISOString();
    let channel = this.cached[channelNumber];
    if (typeof channel === undefined) {
      return;
    }
    let programs = channel.programs;
    let result: ChannelLineup = {
      icon: channel.channel.icon,
      name: channel.channel.name,
      number: channel.channel.number,
      programs: [],
    };
    for (let i = 0; i < programs.length; i++) {
      let program = programs[i];
      let a: string;
      if (program.start > beginningTimeMs) {
        a = program.start;
      } else {
        a = beginningTimeMs;
      }
      let b: string;
      if (program.stop < endTimeMs) {
        b = program.stop;
      } else {
        b = endTimeMs;
      }

      if (a < b) {
        result.programs.push(program);
      }
    }
    return result;
  }
}

function _wait(t: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, t);
  });
}

function getChannelStealthDuration(channel: Partial<Channel>) {
  if (
    !isUndefined(channel.guideMinimumDurationSeconds) &&
    !isNaN(channel.guideMinimumDurationSeconds)
  ) {
    return channel.guideMinimumDurationSeconds * 1000;
  } else {
    return constants.DEFAULT_GUIDE_STEALTH_DURATION;
  }
}

function isProgramFlex(program: Partial<Program>, channel: Partial<Channel>) {
  return (
    program.isOffline ||
    (program.duration ?? 0) <= getChannelStealthDuration(channel)
  );
}

function clone(o) {
  return JSON.parse(JSON.stringify(o));
}

function makeChannelEntry(channel: Channel) {
  return {
    name: channel.name,
    icon: channel.icon,
    number: channel.number,
  };
}

function makeEntry(
  channel: Partial<Channel>,
  x: CurrentPlayingProgram,
): TvGuideProgram {
  let title: string | undefined;
  let icon: string | undefined;
  let sub: TvGuideProgramSubtitle | undefined;
  if (isProgramFlex(x.program, channel)) {
    if (
      isString(channel.guideFlexPlaceholder) &&
      !isEmpty(channel.guideFlexPlaceholder)
    ) {
      title = channel.guideFlexPlaceholder;
    } else {
      title = channel.name;
    }
    icon = channel.icon?.path;
  } else {
    title = x.program.showTitle;
    if (typeof x.program.icon !== 'undefined') {
      icon = x.program.icon;
    }
    if (x.program.type === 'episode') {
      sub = {
        season: x.program.season,
        episode: x.program.episode,
        title: x.program.title,
      };
    }
  }
  if (isUndefined(title)) {
    title = '.';
  }
  //what data is needed here?
  return {
    start: new Date(x.startTimeMs).toISOString(),
    stop: new Date(x.startTimeMs + (x.program.duration ?? 0)).toISOString(),
    summary: x.program.summary,
    date: x.program.date,
    rating: x.program.rating,
    icon: icon,
    title: title,
    sub: sub,
  };
}

function formatDateYYYYMMDD(date) {
  var year = date.getFullYear().toString();
  var month = (date.getMonth() + 101).toString().substring(1);
  var day = (date.getDate() + 100).toString().substring(1);
  return year + '-' + month + '-' + day;
}
