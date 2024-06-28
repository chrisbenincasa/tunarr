import constants from '@tunarr/shared/constants';
import {
  ChannelIcon,
  ChannelLineup,
  ChannelProgram,
  CustomGuideProgram,
  FlexGuideProgram,
  RedirectGuideProgram,
  TvGuideProgram,
  isContentProgram,
} from '@tunarr/types';
import retry from 'async-retry';
import dayjs from 'dayjs';
import duration, { Duration } from 'dayjs/plugin/duration.js';
import {
  inRange,
  includes,
  isNil,
  isNull,
  isUndefined,
  keys,
  map,
  mapValues,
  nth,
  reduce,
  round,
  values,
} from 'lodash-es';
import * as syncRetry from 'retry';
import { v4 } from 'uuid';
import { XmlTvWriter } from '../XmlTvWriter.js';
import { ChannelDB } from '../dao/channelDb.js';
import { ProgramConverter } from '../dao/converters/programConverters.js';
import { Lineup } from '../dao/derived_types/Lineup.js';
import { Maybe } from '../types/util.js';
import { binarySearchRange } from '../util/binarySearch.js';
import {
  deepCopy,
  groupByUniqFunc,
  isNonEmptyString,
  wait,
} from '../util/index.js';
import { LoggerFactory } from '../util/logging/LoggerFactory.js';
import { EventService } from './eventService.js';
import { ChannelWithPrograms as RawChannel } from '../dao/direct/derivedTypes.js';

dayjs.extend(duration);

// TODO - don't do this.
const FALLBACK_ICON =
  'https://raw.githubusercontent.com/chrisbenincasa/tunarr/main/server/resources/images/tunarr.png';

type CurrentPlayingProgram = {
  programIndex?: number;
  startTimeMs: number;
  program: ChannelProgram;
};

export type TvGuideChannel = {
  name: string;
  number: number;
  id: string;
  icon?: ChannelIcon;
};

export type ChannelPrograms = {
  channel: RawChannel;
  programs: TvGuideProgram[];
};

type ChannelWithLineup = {
  channel: RawChannel;
  lineup: Lineup;
};

type ChannelId = string;

export class TVGuideService {
  private logger = LoggerFactory.child({ caller: import.meta });
  private xmltv: XmlTvWriter;
  private channelDb: ChannelDB;
  private eventService: EventService;
  private programConverter: ProgramConverter;
  private cachedGuide: Record<ChannelId, ChannelPrograms>;
  private lastUpdateTime: number;
  private lastEndTime: number;
  private currentUpdateTime: number;
  private currentEndTime: number;
  private currentChannels: ChannelWithLineup[];
  private accumulateTable: Record<string, number[]> = {};
  private channelsById: Record<string, ChannelWithLineup>;

  constructor(
    xmltv: XmlTvWriter,
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
    this.eventService = eventService;
    this.channelDb = channelDb;
    this.programConverter = new ProgramConverter();
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

  async refreshGuide(guideDuration: Duration, force: boolean = false) {
    const now = new Date().getTime();
    if (force || (this.lastUpdateTime < now && this.currentUpdateTime === -1)) {
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
            channel,
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
      this.logger.warn(
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
      id: channel.uuid,
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

  // If we updated channel metadata, we should push it to this cache
  // and rewrite xmltv. This should be very fast since we're not altering
  // programming details or the schedule
  async updateCachedChannel(updatedChannelId: string) {
    const channel = await this.channelDb.getChannelDirect(updatedChannelId);
    if (isNil(channel)) {
      this.logger.warn(
        'Could not find channel with id %s when attempting to update cached XMLTV channels',
        updatedChannelId,
      );
      return;
    }

    const cachedLineup = this.cachedGuide[channel.uuid];
    if (isUndefined(cachedLineup)) {
      return;
    }

    const existingChannel = this.cachedGuide[channel.uuid].channel;
    // Keep the refs to the existing programs since they didn't change
    // as part of this operation.
    this.cachedGuide[channel.uuid].channel = {
      ...channel,
      programs: existingChannel.programs,
    };

    return await this.refreshXML();
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
          duration: channelStartTime - currentUpdateTimeMs,
          type: 'flex',
          persisted: true,
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
          persisted: true,
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
      const targetIndex =
        accumulate.length === 1
          ? 0
          : binarySearchRange(accumulate, channelProgress);

      if (
        isNull(targetIndex) ||
        !inRange(targetIndex, 0, accumulate.length) ||
        !inRange(targetIndex, 0, lineup.items.length)
      ) {
        throw new Error(
          `General algorithm error, completely unexpected. Channel: ${channel.uuid} ${channel.name}`,
        );
      }

      const lineupItem = lineup.items[targetIndex];
      let lineupProgram =
        this.programConverter.directLineupItemToChannelProgram(
          channel,
          lineupItem,
          map(this.currentChannels, 'channel'),
        );

      if (isNull(lineupProgram)) {
        this.logger.warn(
          'Unable to convert lineup item to guide item: %O',
          lineupItem,
        );
        lineupProgram = {
          type: 'flex',
          duration: lineupItem.durationMs,
          persisted: false,
        };
      }

      return {
        programIndex: targetIndex,
        startTimeMs: startOfCycle + accumulate[targetIndex],
        program: lineupProgram,
      };
    }
  }

  private async getChannelPlaying(
    channelWithLineup: ChannelWithLineup,
    previousProgram: Maybe<CurrentPlayingProgram>,
    currentUpdateTimeMs: number,
    channelRedirectStack: string[] = [],
  ): Promise<CurrentPlayingProgram> {
    const { channel, lineup } = channelWithLineup;
    let playing: CurrentPlayingProgram;
    if (
      !isUndefined(previousProgram?.programIndex) &&
      inRange(previousProgram.programIndex, 0, lineup.items.length) &&
      // We're trialing removing this, since there is correction for these
      // elsewhere in the algorithm.
      // previousProgram.program.duration ===
      //   lineup.items[previousProgram.programIndex].durationMs &&
      previousProgram.startTimeMs + previousProgram.program.duration ===
        currentUpdateTimeMs
    ) {
      // If we already have the previous program info, we can derive the following
      // This generally happens after we've figured out the first program in
      // the schedule.
      const index = (previousProgram.programIndex + 1) % lineup.items.length;
      const lineupItem = lineup.items[index];
      const program = this.programConverter.directLineupItemToChannelProgram(
        channel,
        lineupItem,
        map(this.currentChannels, 'channel'),
      );

      if (isNull(program)) {
        this.logger.warn(
          'Was unable to convert lineup item to guide item: %O',
          lineupItem,
        );
      }

      playing = {
        programIndex: index,
        program: program ?? {
          type: 'flex',
          persisted: false,
          duration: lineupItem.durationMs,
        },
        startTimeMs: currentUpdateTimeMs,
      };
    } else {
      playing = this.getCurrentPlayingIndex(
        channelWithLineup,
        currentUpdateTimeMs,
      );
    }

    if (isNil(playing) || isNil(playing.program)) {
      this.logger.warn(
        'There is a weird issue with the TV guide generation. A placeholder program is placed to prevent further issues. Please report this.',
      );
      playing = {
        programIndex: -1,
        program: {
          persisted: true,
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
      if (includes(channelRedirectStack, redirectChannel)) {
        this.logger.error(
          `Redirect loop found! Involved channels = %O`,
          channelRedirectStack,
        );
      } else {
        channelRedirectStack.push(redirectChannel);
        const channel2 = this.channelsById[redirectChannel];
        // TODO: Just update the lineup file directly at this point
        if (isUndefined(channel2)) {
          this.logger.error(
            `Redirect to an unknown channel found! Involved channels: %O`,
            channelRedirectStack,
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

          const program2 = deepCopy(redirectChannelProgram.program);
          // Cap the program at the lowest duration
          // Either the redirect slot will cut off before the program is
          // finished, or the program itself will end.
          program2.duration = Math.min(
            playing.program.duration,
            redirectChannelProgram.program.duration,
          );
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
      channel: channelWithLineup.channel,
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
                persisted: true,
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
            persisted: true,
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

    let nextOffsetTime =
      currentProgram.startTimeMs + currentProgram.program.duration;
    while (currentProgram.startTimeMs < currentEndTimeMs) {
      await push(currentProgram);
      const lastProgram = currentProgram;
      currentProgram = await this.getChannelPlaying(
        channelWithLineup,
        currentProgram,
        nextOffsetTime,
      );
      if (currentProgram.startTimeMs < nextOffsetTime) {
        // There are some situations where the durations of the lineup
        // and DB item can go out of sync. For instance, if the DB item
        // has changed to a different underlying file, which was saved as
        // a part of an update for _another_ channel, but this channel's lineup
        // has not been updated yet. In this case, we're handling a situation
        // where the source-of-truth program is shorter than what our lineup says
        // We'll just push a pad and move on - a scheduled task will resolve
        // these discrenpancies.
        if (
          isContentProgram(currentProgram.program) &&
          isContentProgram(lastProgram.program) &&
          currentProgram.program.uniqueId === lastProgram.program.uniqueId &&
          !isUndefined(currentProgram.programIndex) &&
          currentProgram.program.duration <
            (nth(channelWithLineup.lineup.items, currentProgram.programIndex)
              ?.durationMs ?? Number.NEGATIVE_INFINITY)
        ) {
          const lineupDuration = nth(
            channelWithLineup.lineup.items,
            currentProgram.programIndex,
          )!.durationMs;
          const difference = lineupDuration - currentProgram.program.duration;
          await push({
            // programIndex: currentProgram.programIndex,
            program: {
              type: 'flex',
              persisted: false,
              duration: difference,
            },
            startTimeMs: currentProgram.startTimeMs,
          });
          nextOffsetTime += difference;
          currentProgram.startTimeMs += difference;
        } else {
          const d = nextOffsetTime - currentProgram.startTimeMs;
          currentProgram.startTimeMs = nextOffsetTime;
          currentProgram.program = deepCopy(currentProgram.program);
          currentProgram.program.duration -= d;
        }
      } else if (currentProgram.startTimeMs > nextOffsetTime) {
        console.error('does this hit?');
      }

      nextOffsetTime += currentProgram.program.duration;

      if (currentProgram.program.duration <= 0) {
        this.logger.error(
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
              persisted: true,
              duration: d,
              type: 'flex',
            },
          };
          duration -= d;
          start += d;
          result.programs.push(
            programToTvGuideProgram(channelWithLineup.channel, x),
          );
        }
      } else {
        result.programs.push(
          programToTvGuideProgram(channelWithLineup.channel, programs[i]),
        );
      }
    }

    return result;
  }

  private async buildGuideInternal(): Promise<
    Record<ChannelId, ChannelPrograms>
  > {
    const currentUpdateTimeMs = this.currentUpdateTime;
    const channels = this.currentChannels;
    this.channelsById = groupByUniqFunc(channels, (c) => c.channel.uuid);
    this.accumulateTable = mapValues(this.channelsById, (channel) => {
      // We have these precalculated!!
      // Fallback just in case...
      // The offsets should also strictly have one additional item in
      // the array
      if (
        channel.lineup.startTimeOffsets &&
        (channel.lineup.startTimeOffsets.length ===
          channel.lineup.items.length + 1 ||
          channel.lineup.startTimeOffsets?.length ===
            channel.lineup.items.length)
      ) {
        return channel.lineup.startTimeOffsets;
      }

      return this.makeAccumulated(channel);
    });

    const result: Record<string, ChannelPrograms> = {};
    if (channels.length === 0) {
      const fakeChannelId = v4();
      const channel: RawChannel = {
        uuid: fakeChannelId,
        name: 'Tunarr',
        icon: {
          path: FALLBACK_ICON,
          width: 0,
          duration: 0,
          position: 'bottom-right',
        },
        disableFillerOverlay: 0, //false, cast?
        number: 0,
        guideMinimumDuration: 0,
        duration: 0,
        stealth: 0, //false, cast?
        startTime: 0,
        offline: {
          picture: undefined,
          soundtrack: undefined,
          mode: 'pic',
        },
        guideFlexTitle: null,
        createdAt: null,
        updatedAt: null,
        fillerRepeatCooldown: null,
        groupTitle: null,
        watermark: null,
        transcoding: null,
        programs: [],
      };

      // Placeholder channel with random ID.
      result[fakeChannelId] = {
        channel: channel,
        programs: [
          programToTvGuideProgram(channel, {
            startTimeMs:
              currentUpdateTimeMs - (currentUpdateTimeMs % (30 * 60 * 1000)),
            program: {
              duration: 24 * 60 * 60 * 1000,
              icon: FALLBACK_ICON,
              // showTitle: 'No channels configured',
              // date: dayjs().format('YYYY-MM-DD'),
              // summary: 'Use the tunarr web UI to configure channels.',
              type: 'flex',
              persisted: false,
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
          const start = performance.now();
          const thisGuideLength = this.currentEndTime - this.currentUpdateTime;
          this.cachedGuide = await this.buildGuideInternal();
          // This was moved from a finally block, make sure that is right...
          this.lastUpdateTime = this.currentUpdateTime;
          this.lastEndTime = this.currentEndTime;
          this.currentUpdateTime = -1;
          await this.refreshXML();
          const diff = performance.now() - start;
          this.logger.debug(
            'Built TV Guide for %s in %d millis',
            dayjs.duration(thisGuideLength).humanize(),
            round(diff, 3),
          );
        } catch (err) {
          this.logger.error('Unable to update internal guide data', err);
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
    // const xmltvSettings = (await getSettings()).xmlTvSettings();
    await this.xmltv.write(values(this.cachedGuide));
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
  program: ChannelProgram | undefined,
  channel: RawChannel,
): boolean {
  return (
    !isUndefined(program) &&
    (program.type === 'flex' ||
      program.duration <=
        (channel.guideMinimumDuration ??
          constants.DEFAULT_GUIDE_STEALTH_DURATION))
  );
}

function programToTvGuideProgram(
  channel: RawChannel,
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
    return {
      type: 'flex',
      icon,
      title: isNonEmptyString(channel.guideFlexTitle)
        ? channel.guideFlexTitle
        : channel.name,
      ...baseItem,
    } as FlexGuideProgram;
  } else if (currentProgram.program.type === 'custom') {
    return {
      type: 'custom',
      id: currentProgram.program.id,
      ...baseItem,
    } as CustomGuideProgram;
  } else if (currentProgram.program.type === 'redirect') {
    return {
      type: 'redirect',
      channel: currentProgram.program.channel,
      ...baseItem,
    } as RedirectGuideProgram;
  }

  if (!isUndefined(currentProgram.program.icon)) {
    icon = currentProgram.program.icon;
  }

  return {
    ...currentProgram.program,
    start: currentProgram.startTimeMs,
    stop: currentProgram.startTimeMs + currentProgram.program.duration,
  };
}
