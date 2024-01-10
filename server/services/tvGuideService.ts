import { EntityDTO, Loaded } from '@mikro-orm/core';
import {
  ChannelIcon,
  ChannelLineup,
  CustomGuideProgram,
  FlexGuideProgram,
  Program as ProgramDTO,
  RedirectGuideProgram,
  TvGuideProgram,
} from 'dizquetv-types';
import { compact, isNil, isUndefined, keys, mapValues } from 'lodash-es';
import assert from 'node:assert';
import { MarkRequired } from 'ts-essentials';
import constants from '../constants.js';
import { ChannelDB } from '../dao/channelDb.js';
import {
  Lineup,
  LineupItem,
  isContentItem,
  isOfflineItem,
} from '../dao/derived_types/Lineup.js';
import { Channel } from '../dao/entities/Channel.js';
import { Program, programDaoToDto } from '../dao/entities/Program.js';
import { getSettings } from '../dao/settings.js';
import createLogger from '../logger.js';
import { Maybe } from '../types.js';
import { groupByUniqFunc, wait } from '../util.js';
import { XmlTvWriter } from '../xmltv.js';
import { CacheImageService } from './cacheImageService.js';
import { EventService } from './eventService.js';
import throttle from './throttle.js';

const logger = createLogger(import.meta);

const FALLBACK_ICON =
  'https://raw.githubusercontent.com/vexorain/dizquetv/main/resources/dizquetv.png';

type CurrentPlayingProgramDetails = MarkRequired<
  Partial<ProgramDTO>,
  'type' | 'isOffline' | 'duration'
>;

type CurrentPlayingProgram = {
  programIndex?: number;
  startTimeMs: number;
  program: CurrentPlayingProgramDetails;
};

function lineupItemToCurrentProgram(
  lineupItem: LineupItem,
  backingItem?: EntityDTO<Program>,
): CurrentPlayingProgramDetails {
  if (isOfflineItem(lineupItem)) {
    return {
      duration: lineupItem.durationMs,
      type: 'flex',
      isOffline: true,
    };
  } else if (isContentItem(lineupItem)) {
    return programDaoToDto(backingItem!);
  } else {
    return {
      type: 'redirect',
      isOffline: true,
      duration: lineupItem.durationMs,
      channel: lineupItem.channel,
    };
  }
}

export type TvGuideChannel = {
  name: string;
  number: number;
  icon?: EntityDTO<ChannelIcon>;
};

export type ChannelPrograms = {
  channel: TvGuideChannel;
  programs: TvGuideProgram[];
};

type ChannelWithLineup = {
  channel: EntityDTO<Loaded<Channel, 'programs'>>;
  lineup: Lineup;
};

export class TVGuideService {
  private cached: Record<number, ChannelPrograms>;
  private lastUpdate: number;
  private lastBackoff: number;
  private updateTime: number;
  private currentUpdate: number;
  private currentLimit: number;
  private currentChannels: ChannelWithLineup[];
  private xmltv: XmlTvWriter;
  private cacheImageService: CacheImageService;
  private eventService: EventService;
  private _throttle: () => Promise<void>;
  private updateLimit: number;
  private updateChannels: EntityDTO<Channel>[];
  private accumulateTable: Record<number, number[]> = {};
  private channelsByNumber: Record<number, ChannelWithLineup>;
  private channelDb: ChannelDB;
  /****
   *
   **/
  constructor(
    xmltv: XmlTvWriter,
    cacheImageService: CacheImageService,
    eventService: EventService,
    channelDb: ChannelDB,
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
    this.channelDb = channelDb;
    this._throttle = throttle;
  }

  async get() {
    while (this.cached == null) {
      await wait(100);
    }

    return this.cached;
  }

  prepareRefresh(
    inputChannels: EntityDTO<Loaded<Channel, 'programs'>>[],
    limit: number,
  ) {
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
        this.currentChannels = await this.updateChannels.sequentialPromises(
          async (channel) => {
            return {
              channel,
              lineup: await this.channelDb.loadLineup(channel.number),
            };
          },
        );
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
      await wait(100);
    }
    return await this.get();
  }

  // Returns duration offsets for programs on a channel in an array
  makeAccumulated(channelAndLineup: ChannelWithLineup): number[] {
    const n = channelAndLineup.lineup.items.length;
    const arr = new Array<number>(n + 1);
    arr[0] = 0;
    for (let i = 0; i < n; i++) {
      arr[i + 1] = arr[i] + channelAndLineup.lineup.items[i].durationMs;
    }
    return arr;
  }

  getCurrentPlayingIndex(
    { channel, lineup }: ChannelWithLineup,
    currentUpdateTimeMs: number,
  ): CurrentPlayingProgram {
    const channelStartTime = new Date(channel.startTime).getTime();
    if (currentUpdateTimeMs < channelStartTime) {
      //it's flex time
      return {
        programIndex: -1,
        startTimeMs: currentUpdateTimeMs,
        program: {
          isOffline: true,
          duration: channelStartTime - currentUpdateTimeMs,
          type: 'flex',
        },
      };
    } else if (lineup.items.length === 0) {
      // This is sorta hacky...
      const d = currentUpdateTimeMs - channelStartTime;
      return {
        programIndex: 0,
        startTimeMs: currentUpdateTimeMs - d,
        program: {
          type: 'flex',
          duration: Number.MAX_SAFE_INTEGER,
          isOffline: true,
        },
      };
    } else {
      const accumulate = this.accumulateTable[channel.number];
      if (isUndefined(accumulate)) {
        throw Error(channel.number + " wasn't preprocesed correctly???!?");
      }
      let hi = lineup.items.length;
      let lo = 0;
      const d =
        (currentUpdateTimeMs - channelStartTime) %
        accumulate[lineup.items.length];
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

      const lineupItem = lineup.items[lo];
      let lineupProgram: CurrentPlayingProgramDetails;
      if (isContentItem(lineupItem)) {
        const program = channel.programs.find((p) => p.uuid === lineupItem.id);
        assert(!isNil(program));
        lineupProgram = programDaoToDto(program);
      } else if (isOfflineItem(lineupItem)) {
        lineupProgram = {
          type: 'flex',
          duration: lineupItem.durationMs,
          isOffline: true,
        };
      } else {
        lineupProgram = {
          type: 'redirect',
          isOffline: true,
          duration: lineupItem.durationMs,
          channel: lineupItem.channel,
        };
      }

      return {
        programIndex: lo,
        startTimeMs: epoch + accumulate[lo],
        program: lineupProgram,
      };
    }
  }

  async getChannelPlaying(
    { channel, lineup }: ChannelWithLineup,
    previousKnown: Maybe<CurrentPlayingProgram>,
    currentUpdateTimeMs: number,
    depth: number[] = [],
  ): Promise<CurrentPlayingProgram> {
    let playing: CurrentPlayingProgram;
    if (
      !isUndefined(previousKnown) &&
      !isUndefined(previousKnown.programIndex) &&
      lineup.items.length > 0 &&
      previousKnown.programIndex !== -1 &&
      previousKnown.program.duration ==
        lineup.items[previousKnown.programIndex].durationMs &&
      previousKnown.startTimeMs + previousKnown.program.duration ==
        currentUpdateTimeMs
    ) {
      //turns out we know the index.
      const index = (previousKnown.programIndex + 1) % lineup.items.length;
      const lineupItem = lineup.items[index];
      const backingItem = isContentItem(lineupItem)
        ? channel.programs.find((p) => p.uuid === lineupItem.id)
        : undefined;
      playing = {
        programIndex: index,
        program: lineupItemToCurrentProgram(lineup.items[index], backingItem),
        startTimeMs: currentUpdateTimeMs,
      };
    } else {
      playing = this.getCurrentPlayingIndex(
        { channel, lineup },
        currentUpdateTimeMs,
      );
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
          type: 'flex',
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
            playing.startTimeMs + playing.program.duration - start,
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
    channelWithLineup: ChannelWithLineup,
  ): Promise<ChannelPrograms> {
    if (isUndefined(channelWithLineup)) {
      throw Error("Couldn't find channel?");
    }
    const result: ChannelPrograms = {
      channel: makeChannelEntry(channelWithLineup.channel),
      programs: [],
    };

    const programs: CurrentPlayingProgram[] = [];

    let currentProgram = await this.getChannelPlaying(
      channelWithLineup,
      undefined,
      currentUpdateTimeMs,
    );

    if (currentProgram.program.duration == 0) {
      throw Error(
        'A ' +
          channelWithLineup.channel.name +
          ' ' +
          JSON.stringify(currentProgram),
      );
    }

    let melded = 0;

    const push = async (program: CurrentPlayingProgram) => {
      await this._throttle();
      if (
        programs.length > 0 &&
        isProgramFlex(program.program, channelWithLineup.channel) &&
        ((program.program.duration ?? 0) <=
          constants.TVGUIDE_MAXIMUM_PADDING_LENGTH_MS ||
          isProgramFlex(
            programs[programs.length - 1].program,
            channelWithLineup.channel,
          ))
      ) {
        //meld with previous
        const y = clone(programs[programs.length - 1]);
        y.program.duration += program.program.duration;
        melded += program.program.duration ?? 0;
        if (
          melded > constants.TVGUIDE_MAXIMUM_PADDING_LENGTH_MS &&
          !isProgramFlex(
            programs[programs.length - 1].program,
            channelWithLineup.channel,
          )
        ) {
          y.program.duration -= melded;
          programs[programs.length - 1] = y;
          if (y.startTimeMs + y.program.duration < currentEndTimeMs) {
            programs.push({
              startTimeMs: y.startTimeMs + y.program.duration,
              program: {
                isOffline: true,
                duration: melded,
                type: 'flex',
              },
            });
          }
          melded = 0;
        } else {
          programs[programs.length - 1] = y;
        }
      } else if (isProgramFlex(program.program, channelWithLineup.channel)) {
        melded = 0;
        programs.push({
          startTimeMs: program.startTimeMs,
          program: {
            isOffline: true,
            duration: program.program.duration,
            type: 'flex',
          },
        });
      } else {
        melded = 0;
        programs.push(program);
      }
    };

    while (currentProgram.startTimeMs < currentEndTimeMs) {
      await push(currentProgram);
      const t2 =
        currentProgram.startTimeMs + (currentProgram.program.duration ?? 0);
      currentProgram = await this.getChannelPlaying(
        channelWithLineup,
        currentProgram,
        t2,
      );
      if (currentProgram.startTimeMs < t2) {
        const d = t2 - currentProgram.startTimeMs;
        currentProgram.startTimeMs = t2;
        currentProgram.program = clone(currentProgram.program);
        if (currentProgram.program.duration) {
          currentProgram.program.duration -= d;
        }
      }
      if (currentProgram.program.duration == 0) {
        logger.error("There's a program with duration 0?");
      }
    }

    result.programs = [];
    for (let i = 0; i < programs.length; i++) {
      await this._throttle();
      if (isProgramFlex(programs[i].program, channelWithLineup.channel)) {
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
              type: 'flex',
            },
          };
          duration -= d;
          start += d;
          result.programs.push(makeEntry(channelWithLineup.channel, x));
        }
      } else {
        result.programs.push(makeEntry(channelWithLineup.channel, programs[i]));
      }
    }

    return result;
  }

  private async buildItManaged(): Promise<Record<number, ChannelPrograms>> {
    const currentUpdateTimeMs = this.currentUpdate;
    const currentEndTimeMs = this.currentLimit;
    const channels = this.currentChannels;
    this.channelsByNumber = groupByUniqFunc(channels, (c) => c.channel.number);
    const accumulateTablePromises = mapValues(
      this.channelsByNumber,
      (channel) => this.makeAccumulated(channel),
    );
    for (const channelId in accumulateTablePromises) {
      this.accumulateTable[channelId] = accumulateTablePromises[channelId];
    }

    const result = {};
    if (channels.length == 0) {
      const channel: Partial<EntityDTO<Channel>> = {
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
              type: 'flex',
              isOffline: true,
            },
          }),
        ],
      };
    } else {
      for (const { channel, lineup } of channels) {
        if (!channel.stealth) {
          const programs = await this.getChannelPrograms(
            currentUpdateTimeMs,
            currentEndTimeMs,
            { channel, lineup },
          );
          result[channel.number] = programs;
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
      const w = Math.min(this.lastBackoff * 2, 300000);
      await wait(w);
      this.lastBackoff = w;
      logger.error(`Retrying TV guide after ${w} milliseconds wait...`);
      await this.buildIt();
    } finally {
      this.lastUpdate = this.currentUpdate;
      this.currentUpdate = -1;
    }
  }

  async refreshXML() {
    const xmltvSettings = (await getSettings()).xmlTvSettings();
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
    const beginningTimeMs = dateFrom.getTime();
    const endTimeMs = dateTo.getTime();
    const { channel, programs } = this.cached[channelNumber];
    if (isNil(channel)) {
      return;
    }

    const result: ChannelLineup = {
      icon: channel.icon,
      name: channel.name,
      number: channel.number,
      programs: [],
    };

    for (const program of programs) {
      let a: number;
      if (program.start > beginningTimeMs) {
        a = program.start;
      } else {
        a = beginningTimeMs;
      }
      let b: number;
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

function getChannelStealthDuration(channel: Partial<EntityDTO<Channel>>) {
  if (!isUndefined(channel.guideMinimumDurationSeconds)) {
    return channel.guideMinimumDurationSeconds * 1000;
  } else {
    return constants.DEFAULT_GUIDE_STEALTH_DURATION;
  }
}

function isProgramFlex(
  program: Partial<ProgramDTO>,
  channel: Partial<EntityDTO<Channel>>,
): program is MarkRequired<ProgramDTO, 'duration'> {
  return (
    program.isOffline ||
    (program.duration ?? 0) <= getChannelStealthDuration(channel)
  );
}

// Remove this...
function clone<T>(o: T): T {
  return JSON.parse(JSON.stringify(o)) as T;
}

function makeChannelEntry(channel: EntityDTO<Channel>): TvGuideChannel {
  return {
    name: channel.name,
    icon: channel.icon,
    number: channel.number,
  };
}

function makeEntry(
  channel: Partial<EntityDTO<Channel>>,
  currentProgram: CurrentPlayingProgram,
): TvGuideProgram {
  const baseItem: Partial<TvGuideProgram> = {
    start: currentProgram.startTimeMs,
    stop: currentProgram.startTimeMs + (currentProgram.program.duration ?? 0),
    persisted: true,
    duration: currentProgram.program.duration ?? 0,
  };

  let title: string | undefined;
  let icon: string | undefined;
  let seasonNumber: Maybe<number>;
  let episodeNumber: Maybe<number>;
  let episodeTitle: Maybe<string>;
  if (currentProgram.program.type === 'flex') {
    // ehhhh
    // if (
    //   isString(channel.guideFlexPlaceholder) &&
    //   !isEmpty(channel.guideFlexPlaceholder)
    // ) {
    //   title = channel.guideFlexPlaceholder;
    // } else {
    //   title = channel.name;
    // }
    icon = channel.icon?.path;
    return {
      type: 'flex',
      icon,
      ...baseItem,
    } as FlexGuideProgram;
  } else if (currentProgram.program.type === 'custom') {
    return {
      type: 'custom',
      id: currentProgram.program.id!,
      ...baseItem,
    } as CustomGuideProgram;
  } else if (currentProgram.program.type === 'redirect') {
    return {
      type: 'redirect',
      channel: currentProgram.program.channel!,
      ...baseItem,
    } as RedirectGuideProgram;
  }

  title = currentProgram.program.showTitle;
  if (typeof currentProgram.program.icon !== 'undefined') {
    icon = currentProgram.program.icon;
  }
  if (currentProgram.program.type === 'episode') {
    seasonNumber = currentProgram.program.season;
    episodeNumber = currentProgram.program.episode;
    episodeTitle = currentProgram.program.title;
  }
  if (isUndefined(title)) {
    title = '.';
  }
  //what data is needed here?
  return {
    start: currentProgram.startTimeMs,
    stop: currentProgram.startTimeMs + (currentProgram.program.duration ?? 0),
    summary: currentProgram.program.summary,
    date: currentProgram.program.date,
    rating: currentProgram.program.rating,
    icon: icon,
    title: title,
    duration: currentProgram.program?.duration,
    type: 'content',
    id: currentProgram.program.id,
    subtype: currentProgram.program?.type,
    persisted: true,
    seasonNumber,
    episodeNumber,
    episodeTitle,
  };
}

function formatDateYYYYMMDD(date: Date) {
  const year = date.getFullYear().toString();
  const month = (date.getMonth() + 101).toString().substring(1);
  const day = (date.getDate() + 100).toString().substring(1);
  return year + '-' + month + '-' + day;
}
