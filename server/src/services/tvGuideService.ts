import { EntityDTO, Loaded, serialize } from '@mikro-orm/core';
import constants from '@tunarr/shared/constants';
import {
  ChannelIcon,
  ChannelLineup,
  CustomGuideProgram,
  FlexGuideProgram,
  Program as ProgramDTO,
  RedirectGuideProgram,
  TvGuideProgram,
} from '@tunarr/types';
import retry from 'async-retry';
import dayjs from 'dayjs';
import duration, { Duration } from 'dayjs/plugin/duration.js';
import {
  inRange,
  isNil,
  isNull,
  isUndefined,
  keys,
  mapValues,
  nth,
  reduce,
  values,
} from 'lodash-es';
import * as syncRetry from 'retry';
import { MarkRequired } from 'ts-essentials';
import { v4 } from 'uuid';
import { ChannelDB } from '../dao/channelDb.js';
import {
  Lineup,
  LineupItem,
  isContentItem,
} from '../dao/derived_types/Lineup.js';
import { Channel } from '../dao/entities/Channel.js';
import { Program, programDaoToDto } from '../dao/entities/Program.js';
import { getSettings } from '../dao/settings.js';
import createLogger from '../logger.js';
import { Maybe } from '../types.js';
import { deepCopy, groupByUniqFunc, wait } from '../util.js';
import { binarySearchRange } from '../util/binarySearch.js';
import { XmlTvWriter } from '../xmltv.js';
import { CacheImageService } from './cacheImageService.js';
import { EventService } from './eventService.js';

dayjs.extend(duration);

const logger = createLogger(import.meta);

const FALLBACK_ICON =
  'https://raw.githubusercontent.com/vexorain/dizquetv/main/resources/dizquetv.png';

type CurrentPlayingProgramDetails = MarkRequired<
  Partial<ProgramDTO> & { isOffline: boolean }, // Hack to make this work for now, we need a new type
  'type' | 'duration'
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
  switch (lineupItem.type) {
    case 'content': {
      if (isNil(backingItem)) {
        logger.warn(
          'Backing item for lineup item (ID %s) was null, which means it was probably deleted from the DB',
          lineupItem.id,
        );
        return {
          duration: lineupItem.durationMs,
          type: 'flex',
          isOffline: true,
        };
      }
      return { ...programDaoToDto(backingItem), isOffline: false };
    }

    case 'offline': {
      return {
        duration: lineupItem.durationMs,
        type: 'flex',
        isOffline: true,
      };
    }
    case 'redirect': {
      return {
        type: 'redirect',
        isOffline: true,
        duration: lineupItem.durationMs,
        channel: lineupItem.channel,
      };
    }
  }
}

export type TvGuideChannel = {
  name: string;
  number: number;
  id: string;
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

type ChannelId = string;

export class TVGuideService {
  private xmltv: XmlTvWriter;
  private channelDb: ChannelDB;
  private eventService: EventService;

  private cachedGuide: Record<ChannelId, ChannelPrograms>; // ChannelId -> ChannelPrograms
  private lastUpdateTime: number;
  private lastEndTime: number;
  private currentUpdateTime: number;
  private currentEndTime: number;
  private currentChannels: ChannelWithLineup[];
  private cacheImageService: CacheImageService;
  private accumulateTable: Record<string, number[]> = {};
  private channelsById: Record<string, ChannelWithLineup>;

  constructor(
    xmltv: XmlTvWriter,
    cacheImageService: CacheImageService,
    eventService: EventService,
    channelDb: ChannelDB,
  ) {
    this.cachedGuide = {};
    this.lastUpdateTime = 0;
    this.lastEndTime = -1;
    this.currentUpdateTime = -1;
    this.currentEndTime = -1;
    this.currentChannels = [];
    this.xmltv = xmltv;
    this.cacheImageService = cacheImageService;
    this.eventService = eventService;
    this.channelDb = channelDb;
  }

  /**
   *
   * @returns The current cached guide
   */
  async get() {
    if (!isNil(this.cachedGuide)) {
      return this.cachedGuide;
    }

    return new Promise((resolve, reject) => {
      const operation = syncRetry.operation({
        retries: 600,
        factor: 1,
        maxRetryTime: 100,
      });
      operation.attempt(() => {
        if (this.cachedGuide !== null) {
          resolve(this.cachedGuide);
        } else if (!operation.retry()) {
          reject(new Error('Timed out waiting for TV guide'));
        }
      });
    });
  }

  async refreshGuide(guideDuration: Duration) {
    const now = new Date().getTime();
    if (this.lastUpdateTime < now && this.currentUpdateTime === -1) {
      this.currentUpdateTime = now;
      this.currentEndTime = now + guideDuration.asMilliseconds();

      this.eventService.push({
        type: 'xmltv',
        message: `Started building tv-guide at = ${dayjs(now).format()}`,
        module: 'xmltv',
        detail: {
          time: now,
        },
        level: 'info',
      });

      this.currentChannels = values(
        mapValues(
          await this.channelDb.loadAllLineups(),
          ({ channel, lineup }) => ({
            channel: serialize(channel, { populate: ['programs'] }),
            lineup,
          }),
        ),
      );
      await this.buildGuideWithRetries();
    }
    return await this.get();
  }

  async getStatus() {
    await this.get();

    return {
      lastUpdate: new Date(this.lastUpdateTime).toISOString(),
      channelIds: keys(this.cachedGuide),
    };
  }

  async getChannelLineup(
    channelId: string,
    dateFrom: Date,
    dateTo: Date,
  ): Promise<Maybe<ChannelLineup>> {
    await this.get();
    const beginningTimeMs = dateFrom.getTime();
    const endTimeMs = dateTo.getTime();

    if (endTimeMs > this.lastEndTime) {
      logger.warn(
        'End time exceeds what the current cached guide generation (requested: %s, end: %s)',
        dayjs(endTimeMs).format(),
        dayjs(this.lastEndTime).format(),
      );
    }

    const channelAndLineup = this.cachedGuide[channelId];
    if (isNil(channelAndLineup)) {
      return;
    }

    const { channel, programs } = channelAndLineup;

    const result: ChannelLineup = {
      icon: channel.icon,
      name: channel.name,
      number: channel.number,
      id: channel.id,
      programs: [],
    };

    for (const program of programs) {
      const startTime = Math.max(program.start, beginningTimeMs);
      const stopTime = Math.min(program.stop, endTimeMs);

      if (startTime < stopTime) {
        result.programs.push(program);
      }
    }

    return result;
  }

  // Returns duration offsets for programs on a channel in an array
  private makeAccumulated(channelAndLineup: ChannelWithLineup): number[] {
    return reduce(
      channelAndLineup.lineup.items,
      (acc, item, index) => [...acc, acc[index] + item.durationMs],
      [0],
    );
  }

  private getCurrentPlayingIndex(
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
      return {
        programIndex: 0,
        startTimeMs: currentUpdateTimeMs,
        program: {
          type: 'flex',
          duration: dayjs.duration({ months: 1 }).asMilliseconds(),
          isOffline: true,
        },
      };
    } else {
      const accumulate = this.accumulateTable[channel.uuid];
      if (isUndefined(accumulate)) {
        throw new Error(channel.number + " wasn't preprocesed correctly???!?");
      }

      // How many ms we are "into" the current channel cycle
      const channelProgress =
        (currentUpdateTimeMs - channelStartTime) % channel.duration;

      // The timestamp of the start of this cycle
      const startOfCycle = currentUpdateTimeMs - channelProgress;

      // Binary search for the currently playing program
      const targetIndex = binarySearchRange(accumulate, channelProgress);

      if (
        isNull(targetIndex) ||
        !inRange(targetIndex, 0, accumulate.length) ||
        !inRange(targetIndex, 0, lineup.items.length)
      ) {
        throw new Error('General algorithm error, completely unexpected');
      }

      const lineupItem = lineup.items[targetIndex];
      let lineupProgram: CurrentPlayingProgramDetails;
      switch (lineupItem.type) {
        case 'content': {
          const program = channel.programs.find(
            (p) => p.uuid === lineupItem.id,
          );
          if (isNil(program)) {
            logger.warn(
              'Got a nil program (ID %s) when we expected it to be found. This likely means the underlying source of the program was deleted',
              lineupItem.id,
            );
            // For now just stick flex in the schedule
            lineupProgram = {
              isOffline: true,
              type: 'flex',
              duration: lineupItem.durationMs,
            };
          } else {
            lineupProgram = { ...programDaoToDto(program), isOffline: false };
          }
          break;
        }
        case 'offline': {
          lineupProgram = {
            type: 'flex',
            duration: lineupItem.durationMs,
            isOffline: true,
          };
          break;
        }
        case 'redirect': {
          lineupProgram = {
            type: 'redirect',
            isOffline: true,
            duration: lineupItem.durationMs,
            channel: lineupItem.channel,
          };
          break;
        }
      }

      return {
        programIndex: targetIndex,
        startTimeMs: startOfCycle + accumulate[targetIndex],
        program: lineupProgram,
      };
    }
  }

  private async getChannelPlaying(
    { channel, lineup }: ChannelWithLineup,
    previousProgram: Maybe<CurrentPlayingProgram>,
    currentUpdateTimeMs: number,
    channelRedirectStack: string[] = [],
  ): Promise<CurrentPlayingProgram> {
    let playing: CurrentPlayingProgram;
    if (
      !isUndefined(previousProgram?.programIndex) &&
      inRange(previousProgram.programIndex, 0, lineup.items.length) &&
      previousProgram.program.duration ===
        lineup.items[previousProgram.programIndex].durationMs &&
      previousProgram.startTimeMs + previousProgram.program.duration ===
        currentUpdateTimeMs
    ) {
      // If we already have the previous program info, we can derive the following
      // This generally happens after we've figured out the first program in
      // the schedule.
      const index = (previousProgram.programIndex + 1) % lineup.items.length;
      const lineupItem = lineup.items[index];
      const backingItem = isContentItem(lineupItem)
        ? channel.programs.find((p) => p.uuid === lineupItem.id)
        : undefined;
      playing = {
        programIndex: index,
        program: lineupItemToCurrentProgram(lineupItem, backingItem),
        startTimeMs: currentUpdateTimeMs,
      };
    } else {
      playing = this.getCurrentPlayingIndex(
        { channel, lineup },
        currentUpdateTimeMs,
      );
    }

    if (isNil(playing) || isNil(playing.program)) {
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

    // Follow the redirect
    if (
      playing.program.type === 'redirect' &&
      !isUndefined(playing.program.channel)
    ) {
      const redirectChannel = playing.program.channel;

      // Detect redirect loops
      if (channelRedirectStack.indexOf(redirectChannel) !== -1) {
        logger.error(
          `Redirect loop found! Involved channels = ${channelRedirectStack.join(
            ', ',
          )}`,
        );
      } else {
        channelRedirectStack.push(redirectChannel);
        const channel2 = this.channelsById[redirectChannel];
        if (isUndefined(channel2)) {
          logger.error(
            `Redirect to an unknown channel found! Involved channels = [${channelRedirectStack.join(
              ', ',
            )}]`,
          );
        } else {
          const redirectChannelProgram = await this.getChannelPlaying(
            channel2,
            undefined,
            currentUpdateTimeMs,
            channelRedirectStack,
          );
          const start = Math.max(
            playing.startTimeMs,
            redirectChannelProgram.startTimeMs,
          );
          const duration = Math.min(
            playing.startTimeMs + playing.program.duration - start,
            redirectChannelProgram.startTimeMs +
              redirectChannelProgram.program.duration -
              start,
          );
          const program2 = deepCopy(redirectChannelProgram.program);
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

  private async getChannelPrograms(
    currentUpdateTimeMs: number,
    currentEndTimeMs: number,
    channelWithLineup: ChannelWithLineup,
  ): Promise<ChannelPrograms> {
    const result: ChannelPrograms = {
      channel: makeChannelEntry(channelWithLineup.channel),
      programs: [],
    };

    const programs: CurrentPlayingProgram[] = [];

    let melded = 0;

    const push = async (program: CurrentPlayingProgram) => {
      await wait();

      const currentProgram = program.program;
      const previousProgramIndex =
        !isUndefined(program.programIndex) &&
        inRange(program.programIndex - 1, 0, programs.length)
          ? (program.programIndex - 1) % programs.length
          : programs.length - 1;

      const previousProgram = nth(programs, previousProgramIndex);

      if (
        programs.length > 0 &&
        !isNil(previousProgram) &&
        isProgramFlex(currentProgram, channelWithLineup.channel) &&
        (currentProgram.duration <=
          constants.TVGUIDE_MAXIMUM_PADDING_LENGTH_MS ||
          isProgramFlex(previousProgram?.program, channelWithLineup.channel))
      ) {
        // meld with previous
        const meldedProgram = deepCopy(previousProgram);
        meldedProgram.program.duration += currentProgram.duration;
        melded += currentProgram.duration;

        // If we've exceeded the amount of time we're willing to 'prettify'
        // the schedule by combining 'flex' + 'non-flex' programs, then
        // we start over. Remove the time we just added, reset the merge
        // duration, and push a new flex program.
        if (
          melded > constants.TVGUIDE_MAXIMUM_PADDING_LENGTH_MS &&
          !isProgramFlex(previousProgram?.program, channelWithLineup.channel)
        ) {
          meldedProgram.program.duration -= melded;

          programs[previousProgramIndex] = meldedProgram;
          if (
            meldedProgram.startTimeMs + meldedProgram.program.duration <
            currentEndTimeMs
          ) {
            programs.push({
              startTimeMs:
                meldedProgram.startTimeMs + meldedProgram.program.duration,
              program: {
                isOffline: true,
                duration: melded,
                type: 'flex',
              },
            });
          }
          melded = 0;
        } else {
          programs[previousProgramIndex] = meldedProgram;
        }
      } else if (isProgramFlex(currentProgram, channelWithLineup.channel)) {
        melded = 0;
        programs.push({
          startTimeMs: program.startTimeMs,
          program: {
            isOffline: true,
            duration: currentProgram.duration,
            type: 'flex',
          },
        });
      } else {
        melded = 0;
        programs.push(program);
      }
    };

    let currentProgram = await this.getChannelPlaying(
      channelWithLineup,
      undefined,
      currentUpdateTimeMs,
    );

    if (currentProgram.program.duration <= 0) {
      throw new Error(
        `Found program with invalid duration ${
          currentProgram.program.duration
        } (Channel ${
          channelWithLineup.channel.uuid
        }). Program: ${JSON.stringify(currentProgram)}`,
      );
    }

    while (currentProgram.startTimeMs < currentEndTimeMs) {
      await push(currentProgram);
      const nextOffsetTime =
        currentProgram.startTimeMs + currentProgram.program.duration;
      currentProgram = await this.getChannelPlaying(
        channelWithLineup,
        currentProgram,
        nextOffsetTime,
      );
      if (currentProgram.startTimeMs < nextOffsetTime) {
        const d = nextOffsetTime - currentProgram.startTimeMs;
        currentProgram.startTimeMs = nextOffsetTime;
        currentProgram.program = deepCopy(currentProgram.program);
        currentProgram.program.duration -= d;
      }
      if (currentProgram.program.duration <= 0) {
        logger.error(
          'Invalid program duration = %d?: Channel %s \n %O',
          currentProgram.program.duration,
          channelWithLineup.channel.uuid,
          currentProgram,
        );
      }
    }

    result.programs = [];
    for (let i = 0; i < programs.length; i++) {
      await wait();
      if (isProgramFlex(programs[i].program, channelWithLineup.channel)) {
        let start = programs[i].startTimeMs;
        let duration = programs[i].program.duration;
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

  private async buildGuideInternal(): Promise<Record<number, ChannelPrograms>> {
    const currentUpdateTimeMs = this.currentUpdateTime;
    const channels = this.currentChannels;
    this.channelsById = groupByUniqFunc(channels, (c) => c.channel.uuid);
    this.accumulateTable = mapValues(this.channelsById, (channel) => {
      // We have these precalculated!!
      // Fallback just in case...
      if (channel.lineup.startTimeOffsets) {
        return channel.lineup.startTimeOffsets;
      }

      return this.makeAccumulated(channel);
    });

    const result = {};
    if (channels.length === 0) {
      const channel: Partial<EntityDTO<Channel>> = {
        name: 'Tunarr',
        icon: {
          path: FALLBACK_ICON,
          width: 0,
          duration: 0,
          position: 'bottom',
        },
      };

      // Placeholder channel with random ID.
      result[v4()] = {
        channel: channel,
        programs: [
          makeEntry(channel, {
            startTimeMs:
              currentUpdateTimeMs - (currentUpdateTimeMs % (30 * 60 * 1000)),
            program: {
              duration: 24 * 60 * 60 * 1000,
              icon: FALLBACK_ICON,
              showTitle: 'No channels configured',
              date: dayjs().format('YYYY-MM-DD'),
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
            this.currentEndTime,
            { channel, lineup },
          );
          result[channel.uuid] = programs;
        }
      }
    }
    return result;
  }

  private async buildGuideWithRetries() {
    await retry(
      async () => {
        try {
          this.cachedGuide = await this.buildGuideInternal();
          // This was moved from a finally block, make sure that is right...
          this.lastUpdateTime = this.currentUpdateTime;
          this.lastEndTime = this.currentEndTime;
          this.currentUpdateTime = -1;
          await this.refreshXML();
        } catch (err) {
          logger.error('Unable to update internal guide data', err);
        }
      },
      {
        retries: 15,
        factor: 2,
        maxRetryTime: 30000,
      },
    );
  }

  private async refreshXML() {
    const xmltvSettings = (await getSettings()).xmlTvSettings();
    await this.xmltv.WriteXMLTV(
      this.cachedGuide,
      xmltvSettings,
      async () => await wait(),
      this.cacheImageService,
    );
    this.eventService.push({
      type: 'xmltv',
      message: `XMLTV updated at server time = ${new Date().toISOString()}`,
      module: 'xmltv',
      detail: {
        time: new Date().getTime(),
      },
      level: 'info',
    });
  }
}

function isProgramFlex(
  program: { duration: number; isOffline: boolean } | undefined,
  channel: Partial<EntityDTO<Channel>>,
): boolean {
  return (
    !isUndefined(program) &&
    (program.isOffline ||
      program.duration <=
        (channel.guideMinimumDuration ??
          constants.DEFAULT_GUIDE_STEALTH_DURATION))
  );
}

function makeChannelEntry(channel: EntityDTO<Channel>): TvGuideChannel {
  return {
    name: channel.name,
    icon: channel.icon,
    number: channel.number,
    id: channel.uuid,
  };
}

function makeEntry(
  channel: Partial<EntityDTO<Channel>>,
  currentProgram: CurrentPlayingProgram,
): TvGuideProgram {
  const baseItem: Partial<TvGuideProgram> = {
    start: currentProgram.startTimeMs,
    stop: currentProgram.startTimeMs + currentProgram.program.duration,
    persisted: true,
    duration: currentProgram.program.duration,
  };

  let icon = channel.icon?.path;
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

  let title = currentProgram.program.title;
  let seasonNumber: Maybe<number>;
  let episodeNumber: Maybe<number>;
  let episodeTitle: Maybe<string>;

  if (!isUndefined(currentProgram.program.icon)) {
    icon = currentProgram.program.icon;
  }

  if (currentProgram.program.type === 'episode') {
    if (currentProgram.program.showTitle) {
      title = currentProgram.program.showTitle;
    }
    seasonNumber = currentProgram.program.season;
    episodeNumber = currentProgram.program.episode;
    episodeTitle = currentProgram.program.title;
  }

  //what data is needed here?
  return {
    start: currentProgram.startTimeMs,
    stop: currentProgram.startTimeMs + currentProgram.program.duration,
    summary: currentProgram.program.summary,
    date: currentProgram.program.date,
    rating: currentProgram.program.rating,
    icon: icon,
    title: title ?? '.',
    duration: currentProgram.program.duration,
    type: 'content',
    id: currentProgram.program.id,
    uniqueId:
      currentProgram.program.id ??
      `${currentProgram.program.sourceType}|${currentProgram.program.serverKey}|${currentProgram.program.key}`,
    subtype: currentProgram.program?.type,
    persisted: true,
    seasonNumber,
    episodeNumber,
    episodeTitle,
  };
}
