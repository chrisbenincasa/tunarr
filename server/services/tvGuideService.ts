import { compact, isEmpty, isString, isUndefined, keys } from 'lodash-es';
import { MarkRequired } from 'ts-essentials';
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
import { CacheImageService } from './cacheImageService.js';
import { EventService } from './eventService.js';
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
  currentChannels: ImmutableChannel[];
  xmltv: XmlTvWriter;
  cacheImageService: CacheImageService;
  eventService: EventService;
  _throttle: () => Promise<void>;
  updateLimit: number;
  updateChannels: ImmutableChannel[];
  accumulateTable: Record<number, number[]> = {};
  channelsByNumber: Record<number, ImmutableChannel>;
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
    const t = new Date().getTime();
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
          message: `Started building tv-guide at = ${new Date().toISOString()}`,
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
  makeAccumulated(channel: ImmutableChannel): number[] {
    if (isUndefined(channel.programs)) {
      throw Error(JSON.stringify(channel).slice(0, 200));
    }
    const n = channel.programs.length;
    const arr = new Array<number>(channel.programs.length + 1);
    arr[0] = 0;
    for (let i = 0; i < n; i++) {
      arr[i + 1] = arr[i] + channel.programs[i].duration;
      // await this._throttle();
    }
    return arr;
  }

  getCurrentPlayingIndex(
    channel: ImmutableChannel,
    currentUpdateTimeMs: number,
  ): CurrentPlayingProgram {
    const channelStartTime = new Date(channel.startTimeEpoch).getTime();
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
      const accumulate = this.accumulateTable[channel.number];
      if (isUndefined(accumulate)) {
        throw Error(channel.number + " wasn't preprocesed correctly???!?");
      }
      let hi = channel.programs.length;
      let lo = 0;
      const d =
        (currentUpdateTimeMs - channelStartTime) %
        accumulate[channel.programs.length];
      const epoch = currentUpdateTimeMs - d;
      // Binary search for the currently playing program
      while (lo + 1 < hi) {
        const ha = Math.floor((lo + hi) / 2);
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
    channel: ImmutableChannel,
    previousKnown: Maybe<CurrentPlayingProgram>,
    currentUpdateTimeMs: number,
    depth: number[] = [],
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
      const index = (previousKnown.programIndex + 1) % channel.programs.length;
      playing = {
        programIndex: index,
        program: channel.programs[index],
        startTimeMs: currentUpdateTimeMs,
      };
    } else {
      playing = this.getCurrentPlayingIndex(channel, currentUpdateTimeMs);
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
      const ch2 = playing.program.channel;

      if (depth.indexOf(ch2) != -1) {
        logger.error(
          'Redirrect loop found! Involved channels = ' + JSON.stringify(depth),
        );
      } else {
        depth.push(channel.number);
        const channel2 = this.channelsByNumber[ch2];
        if (isUndefined(channel2)) {
          logger.error(
            'Redirrect to an unknown channel found! Involved channels = ' +
              JSON.stringify(depth),
          );
        } else {
          const otherPlaying = await this.getChannelPlaying(
            channel2,
            undefined,
            currentUpdateTimeMs,
            depth,
          );
          const start = Math.max(playing.startTimeMs, otherPlaying.startTimeMs);
          const duration = Math.min(
            playing.startTimeMs + playing.program.duration! - start,
            otherPlaying.startTimeMs +
              (otherPlaying.program.duration ?? 0) -
              start,
          );
          const program2 = clone(otherPlaying.program);
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
    channel: ImmutableChannel,
  ): Promise<ChannelPrograms> {
    if (isUndefined(channel)) {
      throw Error("Couldn't find channel?");
    }
    const result: ChannelPrograms = {
      channel: makeChannelEntry(channel),
      programs: [],
    };

    const programs: CurrentPlayingProgram[] = [];

    let x = await this.getChannelPlaying(
      channel,
      undefined,
      currentUpdateTimeMs,
    );

    console.log(x);

    if (x.program.duration == 0) {
      throw Error('A ' + channel.name + ' ' + JSON.stringify(x));
    }

    let melded = 0;

    const push = async (x: CurrentPlayingProgram) => {
      await this._throttle();
      if (
        programs.length > 0 &&
        isProgramFlex(x.program, channel) &&
        ((x.program.duration ?? 0) <=
          constants.TVGUIDE_MAXIMUM_PADDING_LENGTH_MS ||
          isProgramFlex(programs[programs.length - 1].program, channel))
      ) {
        //meld with previous
        const y = clone(programs[programs.length - 1]);
        y.program.duration! += x.program.duration;
        melded += x.program.duration ?? 0;
        if (
          melded > constants.TVGUIDE_MAXIMUM_PADDING_LENGTH_MS &&
          !isProgramFlex(programs[programs.length - 1].program, channel)
        ) {
          y.program.duration! -= melded;
          programs[programs.length - 1] = y;
          if (y.startTimeMs + y.program.duration! < currentEndTimeMs) {
            programs.push({
              startTimeMs: y.startTimeMs + y.program.duration!,
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
      const t2 = x.startTimeMs + (x.program.duration ?? 0);
      x = await this.getChannelPlaying(channel, x, t2);
      if (x.startTimeMs < t2) {
        const d = t2 - x.startTimeMs;
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
          const newStart = currentUpdateTimeMs - (currentUpdateTimeMs % M);
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
          const x: CurrentPlayingProgram = {
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

  async buildItManaged(): Promise<Record<number, ChannelPrograms>> {
    const currentUpdateTimeMs = this.currentUpdate;
    const currentEndTimeMs = this.currentLimit;
    const channels = this.currentChannels;
    this.channelsByNumber = groupByUniq(channels, 'number');
    const accumulateTablePromises = groupByUniqAndMap(
      channels,
      'number',
      (channel) => this.makeAccumulated(channel),
    );
    for (const channelId in accumulateTablePromises) {
      this.accumulateTable[channelId] = accumulateTablePromises[channelId];
    }

    const result = {};
    if (channels.length == 0) {
      const channel: Partial<Channel> = {
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
          const programs = await this.getChannelPrograms(
            currentUpdateTimeMs,
            currentEndTimeMs,
            channels[i],
          );
          console.log(channels[i].number, programs);
          result[channels[i].number] = programs;
        }
      }
    }
    return result;
  }

  async buildIt() {
    try {
      this.cached = await this.buildItManaged();
      console.log(keys(this.cached));
      logger.info(
        'Internal TV Guide data refreshed at ' + new Date().toLocaleString(),
      );
      await this.refreshXML();
      this.lastBackoff = 100;
    } catch (err) {
      logger.error('Unable to update internal guide data', err);
      const w = Math.min(this.lastBackoff * 2, 300000);
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
    const xmltvSettings = (await getDB()).xmlTvSettings();
    await this.xmltv.WriteXMLTV(
      this.cached,
      xmltvSettings,
      async () => await this._throttle(),
      this.cacheImageService,
    );
    this.eventService.push('xmltv', {
      message: `XMLTV updated at server time = ${new Date().toISOString()}`,
      module: 'xmltv',
      detail: {
        time: new Date(),
      },
      level: 'info',
    });
  }

  async getStatus() {
    await this.get();

    return {
      lastUpdate: new Date(this.lastUpdate).toISOString(),
      channelNumbers: keys(this.cached),
    };
  }

  async getChannelLineup(
    channelNumber: number,
    dateFrom: Date,
    dateTo: Date,
  ): Promise<Maybe<ChannelLineup>> {
    await this.get();
    const beginningTimeMs = dateFrom.toISOString();
    const endTimeMs = dateTo.toISOString();
    const channel = this.cached[channelNumber];
    if (typeof channel === 'undefined') {
      return;
    }
    const programs = channel.programs;
    console.log(channel.programs);
    const result: ChannelLineup = {
      icon: channel.channel.icon,
      name: channel.channel.name,
      number: channel.channel.number,
      programs: [],
    };
    for (let i = 0; i < programs.length; i++) {
      const program = programs[i];
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

function getChannelStealthDuration(channel: Partial<ImmutableChannel>) {
  if (
    !isUndefined(channel.guideMinimumDurationSeconds) &&
    !isNaN(channel.guideMinimumDurationSeconds)
  ) {
    return channel.guideMinimumDurationSeconds * 1000;
  } else {
    return constants.DEFAULT_GUIDE_STEALTH_DURATION;
  }
}

function isProgramFlex(
  program: Partial<Program>,
  channel: Partial<ImmutableChannel>,
): program is MarkRequired<Program, 'duration'> {
  return (
    program.isOffline ||
    (program.duration ?? 0) <= getChannelStealthDuration(channel)
  );
}

// Remove this...
function clone<T>(o: T): T {
  return JSON.parse(JSON.stringify(o)) as T;
}

function makeChannelEntry(channel: ImmutableChannel) {
  return {
    name: channel.name,
    icon: channel.icon,
    number: channel.number,
  };
}

function makeEntry(
  channel: Partial<ImmutableChannel>,
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

function formatDateYYYYMMDD(date: Date) {
  const year = date.getFullYear().toString();
  const month = (date.getMonth() + 101).toString().substring(1);
  const day = (date.getDate() + 100).toString().substring(1);
  return year + '-' + month + '-' + day;
}
