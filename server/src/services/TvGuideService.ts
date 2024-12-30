import { ChannelDB } from '@/db/ChannelDB.ts';
import { getDatabase } from '@/db/DBAccess.ts';
import { ProgramDB } from '@/db/ProgramDB.ts';
import { ProgramConverter } from '@/db/converters/ProgramConverter.ts';
import { Lineup, LineupItem } from '@/db/derived_types/Lineup.ts';
import { OpenDateTimeRange } from '@/types/OpenDateTimeRange.ts';
import { Maybe } from '@/types/util.ts';
import { binarySearchRange } from '@/util/binarySearch.ts';
import { devAssert } from '@/util/debug.ts';
import { LoggerFactory } from '@/util/logging/LoggerFactory.ts';
import { MutexMap } from '@/util/mutexMap.ts';
import { Timer } from '@/util/perf.ts';
import { makeLocalUrl } from '@/util/serverUtil.ts';
import throttle from '@/util/throttle.ts';
import constants from '@tunarr/shared/constants';
import { seq } from '@tunarr/shared/util';
import {
  ChannelIcon,
  ChannelLineup,
  ChannelProgram,
  TvGuideProgram,
} from '@tunarr/types';
import retry from 'async-retry';
import dayjs from 'dayjs';
import duration, { Duration } from 'dayjs/plugin/duration.js';
import {
  compact,
  filter,
  first,
  flatMap,
  inRange,
  includes,
  isEmpty,
  isNil,
  isNull,
  isUndefined,
  keys,
  map,
  mapValues,
  nth,
  reduce,
  uniq,
  values,
} from 'lodash-es';
import * as syncRetry from 'retry';
import { match } from 'ts-pattern';
import { v4 } from 'uuid';
import {
  ChannelWithPrograms,
  ChannelWithRelations,
  ChannelWithPrograms as RawChannel,
} from '../db/schema/derivedTypes.js';
import {
  deepCopy,
  groupByUniqProp,
  isDefined,
  isNonEmptyString,
  run,
  wait,
} from '../util/index.ts';
import { EventService } from './EventService.ts';
import { XmlTvWriter } from './XmlTvWriter.ts';

dayjs.extend(duration);

// LineupItem + optional index + startTime
type GuideItem = {
  // The underlying lineup item
  lineupItem: LineupItem;
  // Index in the channel lineup sequence
  index?: number;
  // Start time of the program in this guide generation
  startTimeMs: number;
};

export type TvGuideChannel = {
  name: string;
  number: number;
  id: string;
  icon?: ChannelIcon;
};

export type ChannelPrograms = {
  channel: RawChannel;
  programs: GuideItem[];
};

type ChannelWithLineup = {
  channel: RawChannel;
  lineup: Lineup;
};

type ChannelId = string;

export class TVGuideService {
  private logger = LoggerFactory.child({
    caller: import.meta,
    className: this.constructor.name,
  });

  private timer = new Timer(this.logger);
  private locks = new MutexMap();
  private xmltv: XmlTvWriter;
  private eventService: EventService;
  private programConverter: ProgramConverter;
  private cachedGuide: Record<ChannelId, ChannelPrograms>;

  private lastUpdateTime: Record<string, number>;
  private lastEndTime: Record<string, number>;
  private currentUpdateTime: Record<string, number>;
  private currentEndTime: Record<string, number>;

  // These are only defined during the lifetime of a single
  // generation of the guide. Otherwise they inflate memory
  // usage for no benefit. They are not used outside of guide
  // generation.
  private accumulateTable: Record<string, number[]> = {};
  private channelsById: Record<string, ChannelWithLineup>;

  constructor(
    xmltv: XmlTvWriter,
    eventService: EventService,
    private channelDB: ChannelDB,
    private programDB: ProgramDB,
  ) {
    this.cachedGuide = {};
    this.lastUpdateTime = {};
    this.lastEndTime = {};
    this.currentUpdateTime = {};
    this.currentEndTime = {};
    this.xmltv = xmltv;
    this.eventService = eventService;
    this.programConverter = new ProgramConverter();
  }

  /**
   * @returns The current cached guide
   */
  get() {
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
        if (!isEmpty(this.cachedGuide)) {
          resolve(this.cachedGuide);
        } else if (!operation.retry()) {
          reject(new Error('Timed out waiting for TV guide'));
        }
      });
    });
  }

  async buildAllChannels(guideDuration: Duration, force: boolean = false) {
    return this.withGuideContext(async () => {
      if (isEmpty(this.channelsById)) {
        const placeholderChannel = await this.makePlaceholderChannel();
        this.cachedGuide[placeholderChannel.channel.uuid] = placeholderChannel;
      } else {
        await Promise.all(
          keys(this.channelsById).map((channelId) =>
            this.buildChannelGuide(guideDuration, channelId, false, force),
          ),
        );
      }

      await this.writeXmlTv();
    });
  }

  async refreshGuide(
    guideDuration: Duration,
    channelId: string,
    writeXmlTv: boolean = true,
    force: boolean = false,
  ) {
    return this.withGuideContext(async () => {
      return this.buildChannelGuide(
        guideDuration,
        channelId,
        writeXmlTv,
        force,
      );
    });
  }

  /**
   * Gets guide building status by channel
   */
  async getStatus() {
    await this.get();

    return {
      lastUpdate: mapValues(this.lastUpdateTime, (time) =>
        dayjs(time).format(),
      ),
      guideTimes: mapValues(this.cachedGuide, ({ channel, programs }) => ({
        start: dayjs(first(programs)?.startTimeMs).format(),
        end: dayjs(this.lastEndTime[channel.uuid]).format(),
      })),
      channelIds: keys(this.cachedGuide),
    };
  }

  /**
   * Returns the unmaterialized lineup for a channel from the cached guide
   *
   * It's up to callers to materialize the lineup items within with DB details
   */
  async getChannelLineup(
    channelId: string,
    dateFrom: Date,
    dateTo: Date,
  ): Promise<Maybe<GuideItem[]>> {
    await this.get();
    const beginningTimeMs = dateFrom.getTime();
    const endTimeMs = dateTo.getTime();

    const endTime = this.lastEndTime[channelId] ?? 0;
    if (endTimeMs > endTime) {
      this.logger.warn(
        'End time exceeds what the current cached guide generation (requested: %s, end: %s)',
        dayjs(endTimeMs).format(),
        dayjs(endTime).format(),
      );
    }

    const channelAndLineup = this.cachedGuide[channelId];
    if (isNil(channelAndLineup)) {
      return;
    }

    const { programs } = channelAndLineup;

    return seq.collect(programs, (program) => {
      const startTime = Math.max(program.startTimeMs, beginningTimeMs);
      const stopTime = Math.min(
        program.startTimeMs + program.lineupItem.durationMs,
        endTimeMs,
      );

      if (startTime < stopTime) {
        return program;
      }

      return;
    });
  }

  // If we updated channel metadata, we should push it to this cache
  // and rewrite xmltv. This should be very fast since we're not altering
  // programming details or the schedule
  async updateCachedChannel(updatedChannelId: string) {
    const channel = await this.channelDB.getChannel(updatedChannelId);
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

    return await this.writeXmlTv();
  }

  /**
   * Materialize a guide for a specific channel
   * @returns Materialized guide for a channel within the date range
   */
  async getChannelGuide(
    id: string,
    dateRange: OpenDateTimeRange,
  ): Promise<Maybe<Required<ChannelLineup>>> {
    return this.getChannelGuides(dateRange, [id]).then((guide) => first(guide));
  }

  /**
   * Materialize guides for all channels for the time range
   * @returns
   */
  async getAllChannelGuides(
    dateRange: OpenDateTimeRange,
  ): Promise<Required<ChannelLineup>[]> {
    return this.getChannelGuides(dateRange);
  }

  // Initializes per-build context and then clears it
  private async withGuideContext<T>(builder: () => Promise<T>) {
    try {
      this.channelsById = await this.channelDB.loadAllLineups();
      this.accumulateTable = mapValues(this.channelsById, (channel) => {
        const {
          lineup: { items, startTimeOffsets },
        } = channel;
        // We have these precalculated!! Fallback just in case...
        // The offsets should also strictly have one additional item in
        // the array
        if (
          startTimeOffsets &&
          (startTimeOffsets.length === items.length + 1 ||
            startTimeOffsets.length === items.length)
        ) {
          return startTimeOffsets;
        }

        return this.makeAccumulated(channel);
      });

      return await builder();
    } finally {
      this.accumulateTable = {};
      this.channelsById = {};
    }
  }

  private async buildChannelGuide(
    guideDuration: Duration,
    channelId: string,
    writeXmlTv: boolean = true,
    force: boolean = false,
  ) {
    return this.locks.getOrCreateLock(channelId).then((lock) =>
      lock.runExclusive(async () => {
        devAssert(!isEmpty(this.channelsById));
        const now = +dayjs();
        const lastUpdateTime = this.lastUpdateTime[channelId] ?? 0;
        const currentUpdateTime = this.currentUpdateTime[channelId] ?? -1;

        if (force || (lastUpdateTime < now && currentUpdateTime === -1)) {
          this.currentUpdateTime[channelId] = now;
          this.currentEndTime[channelId] = now + guideDuration.asMilliseconds();

          await this.buildChannelGuideWithRetries(channelId, writeXmlTv);
        }
      }),
    );
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
  ): GuideItem {
    const channelStartTime = new Date(channel.startTime).getTime();
    if (currentUpdateTimeMs < channelStartTime) {
      //it's flex time
      return {
        // Ephemeral program - doesn't appear in lineup.
        index: -1,
        startTimeMs: currentUpdateTimeMs,
        lineupItem: {
          durationMs: channelStartTime - currentUpdateTimeMs,
          type: 'offline',
        },
      };
    } else if (lineup.items.length === 0) {
      // This is sorta hacky...
      return {
        index: 0,
        startTimeMs: currentUpdateTimeMs,
        lineupItem: {
          type: 'offline',
          durationMs: dayjs.duration({ months: 1 }).asMilliseconds(),
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

      return {
        index: targetIndex,
        startTimeMs: startOfCycle + accumulate[targetIndex],
        lineupItem,
      };
    }
  }

  private async getChannelPlaying(
    channelWithLineup: ChannelWithLineup,
    previousProgram: Maybe<GuideItem>,
    currentUpdateTimeMs: number,
    channelRedirectStack: string[] = [],
  ): Promise<GuideItem> {
    const { lineup } = channelWithLineup;
    let playing: GuideItem;

    const nextProgramIndex = run(() => {
      if (isUndefined(previousProgram?.index)) {
        return;
      }

      if (!inRange(previousProgram.index, 0, lineup.items.length)) {
        return;
      }

      // We're trialing removing this, since there is correction for these
      // elsewhere in the algorithm.
      if (
        previousProgram.startTimeMs + previousProgram.lineupItem.durationMs !==
        currentUpdateTimeMs
      ) {
        return;
      }

      // Lastly, we need to check if we're actually at the correct offset in the
      // lineup. We may not be at the right offset if we're in the middle of a
      // long redirect block.
      if (
        previousProgram.lineupItem.durationMs > constants.SLACK &&
        previousProgram.lineupItem.durationMs <
          lineup.items[previousProgram.index].durationMs
      ) {
        return;
      }

      return (previousProgram.index + 1) % lineup.items.length;
    });

    if (isDefined(nextProgramIndex)) {
      // If we already have the previous program info, we can derive the following
      // This generally happens after we've figured out the first program in
      // the schedule.
      const index = nextProgramIndex;
      const lineupItem = lineup.items[index];

      playing = {
        index,
        lineupItem,
        startTimeMs: currentUpdateTimeMs,
      };
    } else {
      playing = this.getCurrentPlayingIndex(
        channelWithLineup,
        currentUpdateTimeMs,
      );
    }

    if (isNil(playing) || isNil(playing.lineupItem)) {
      this.logger.warn(
        'There is a weird issue with the TV guide generation. A placeholder program is placed to prevent further issues. Please report this.',
      );
      playing = {
        index: -1,
        lineupItem: {
          durationMs: 30 * 60 * 1000,
          type: 'offline',
        },
        startTimeMs: currentUpdateTimeMs,
      };
    }

    // Follow the redirect
    if (
      playing.lineupItem.type === 'redirect' &&
      isNonEmptyString(playing.lineupItem.channel)
    ) {
      const redirectChannel = playing.lineupItem.channel;

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
          const targetChannelProgram = await this.getChannelPlaying(
            channel2,
            undefined,
            currentUpdateTimeMs,
            channelRedirectStack,
          );

          const start = Math.max(
            playing.startTimeMs,
            targetChannelProgram.startTimeMs,
          );

          const program2 = deepCopy(targetChannelProgram.lineupItem);
          // Cap the program at the lowest duration
          // Either the redirect slot will cut off before the program is
          // finished, or the program itself will end.
          // Rounding is not a perfect solution here, we should normalize
          // fractional durations in channels
          program2.durationMs = Math.round(
            Math.min(
              playing.lineupItem.durationMs,
              targetChannelProgram.lineupItem.durationMs,
            ),
          );
          playing = {
            index: playing.index,
            startTimeMs: start,
            lineupItem: program2,
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
    redirectStack: string[] = [],
  ): Promise<ChannelPrograms> {
    const result: ChannelPrograms = {
      channel: channelWithLineup.channel,
      programs: [],
    };

    const programs: GuideItem[] = [];

    let melded = 0;

    const push = (program: GuideItem) => {
      const currentProgram = program.lineupItem;
      const previousProgramIndex =
        !isUndefined(program.index) &&
        inRange(program.index - 1, 0, programs.length)
          ? (program.index - 1) % programs.length
          : programs.length - 1;

      const previousProgram = nth(programs, previousProgramIndex);

      if (
        programs.length > 0 &&
        !isNil(previousProgram) &&
        isProgramOffline(currentProgram, channelWithLineup.channel) &&
        (currentProgram.durationMs <=
          constants.TVGUIDE_MAXIMUM_PADDING_LENGTH_MS ||
          isProgramOffline(
            previousProgram?.lineupItem,
            channelWithLineup.channel,
          ))
      ) {
        // meld with previous
        const meldedProgram = deepCopy(previousProgram);
        meldedProgram.lineupItem.durationMs += currentProgram.durationMs;
        melded += currentProgram.durationMs;

        // If we've exceeded the amount of time we're willing to 'prettify'
        // the schedule by combining 'flex' + 'non-flex' programs, then
        // we start over. Remove the time we just added, reset the merge
        // duration, and push a new flex program.
        if (
          melded > constants.TVGUIDE_MAXIMUM_PADDING_LENGTH_MS &&
          !isProgramOffline(
            previousProgram?.lineupItem,
            channelWithLineup.channel,
          )
        ) {
          meldedProgram.lineupItem.durationMs -= melded;

          programs[previousProgramIndex] = meldedProgram;
          if (
            meldedProgram.startTimeMs + meldedProgram.lineupItem.durationMs <
            currentEndTimeMs
          ) {
            programs.push({
              startTimeMs:
                meldedProgram.startTimeMs + meldedProgram.lineupItem.durationMs,
              lineupItem: {
                durationMs: melded,
                type: 'offline',
              },
            });
          }
          melded = 0;
        } else {
          programs[previousProgramIndex] = meldedProgram;
        }
      } else if (isProgramOffline(currentProgram, channelWithLineup.channel)) {
        melded = 0;
        programs.push({
          startTimeMs: program.startTimeMs,
          lineupItem: {
            durationMs: currentProgram.durationMs,
            type: 'offline',
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
      redirectStack,
    );

    if (currentProgram.lineupItem.durationMs <= 0) {
      throw new Error(
        `Found program with invalid duration ${
          currentProgram.lineupItem.durationMs
        } (Channel ${
          channelWithLineup.channel.uuid
        }). Program: ${JSON.stringify(currentProgram)}`,
      );
    }

    let nextOffsetTime =
      currentProgram.startTimeMs + currentProgram.lineupItem.durationMs;
    while (currentProgram.startTimeMs < currentEndTimeMs) {
      if (currentProgram.lineupItem.durationMs > 0) {
        push(currentProgram);
        await throttle();
      }

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
          currentProgram.lineupItem.type === 'content' &&
          lastProgram.lineupItem.type === 'content' &&
          currentProgram.lineupItem.id === lastProgram.lineupItem.id &&
          !isUndefined(currentProgram.index) &&
          currentProgram.lineupItem.durationMs <
            (nth(channelWithLineup.lineup.items, currentProgram.index)
              ?.durationMs ?? Number.NEGATIVE_INFINITY)
        ) {
          const lineupDuration = nth(
            channelWithLineup.lineup.items,
            currentProgram.index,
          )!.durationMs;
          const difference =
            lineupDuration - currentProgram.lineupItem.durationMs;

          push({
            lineupItem: {
              type: 'offline',
              durationMs: difference,
            },
            startTimeMs: currentProgram.startTimeMs,
          });

          nextOffsetTime += difference;
          currentProgram.startTimeMs += difference;
        } else {
          const d = nextOffsetTime - currentProgram.startTimeMs;
          currentProgram.startTimeMs = nextOffsetTime;
          currentProgram.lineupItem = deepCopy(currentProgram.lineupItem);
          currentProgram.lineupItem.durationMs -= d;
        }
      } else if (currentProgram.startTimeMs > nextOffsetTime) {
        console.error('does this hit?');
      }

      nextOffsetTime += currentProgram.lineupItem.durationMs;

      if (currentProgram.lineupItem.durationMs <= 0) {
        this.logger.error(
          'Invalid program duration = %d?: Channel %s \n %O',
          currentProgram.lineupItem.durationMs,
          channelWithLineup.channel.uuid,
          currentProgram,
        );
      }
    }

    result.programs = [];
    for (let i = 0; i < programs.length; i++) {
      await wait();
      if (isProgramOffline(programs[i].lineupItem, channelWithLineup.channel)) {
        let start = programs[i].startTimeMs;
        let duration = programs[i].lineupItem.durationMs;
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
          const offlineItem = {
            startTimeMs: start,
            lineupItem: {
              durationMs: d,
              type: 'offline',
            },
          } satisfies GuideItem;

          duration -= d;
          start += d;

          result.programs.push(offlineItem);
        }
      } else {
        result.programs.push(programs[i]);
      }
    }

    return result;
  }

  private async buildGuideInternal(
    channelId: string,
  ): Promise<ChannelPrograms> {
    devAssert(!isEmpty(this.accumulateTable));
    const currentUpdateTimeMs = this.currentUpdateTime[channelId];
    const channelToUpdate = this.channelsById[channelId];
    return this.getChannelPrograms(
      currentUpdateTimeMs,
      this.currentEndTime[channelToUpdate.channel.uuid],
      channelToUpdate,
    );
  }

  private async buildChannelGuideWithRetries(
    channelId: string,
    writeXmlTv: boolean,
  ) {
    const thisGuideLength =
      this.currentEndTime[channelId] - this.currentUpdateTime[channelId];
    const dur = dayjs.duration(thisGuideLength).humanize();
    this.logger.debug('Building Channel %s for %s', channelId, dur);
    await retry(
      async () => {
        try {
          await this.timer.timeAsync(
            `Built Channel ${channelId} TV Guide for ${dur}`,
            async () => {
              this.cachedGuide[channelId] =
                await this.buildGuideInternal(channelId);
              if (writeXmlTv && !this.channelsById[channelId].channel.stealth) {
                await this.writeXmlTv();
              }
            },
          );
        } catch (err) {
          this.logger.error(err, 'Unable to update internal guide data');
        } finally {
          this.lastUpdateTime[channelId] = this.currentUpdateTime[channelId];
          this.lastEndTime[channelId] = this.currentEndTime[channelId];
          this.currentUpdateTime[channelId] = -1;
        }
      },
      {
        retries: 15,
        factor: 2,
        maxRetryTime: 30000,
      },
    );
  }

  private async writeXmlTv() {
    // Materialize the guide to write out the XML.
    const allChannels = map(values(this.channelsById), 'channel');
    await this.xmltv.write(
      map(values(this.cachedGuide), ({ channel, programs }) => {
        return {
          channel,
          programs: map(programs, (program) =>
            this.materializeGuideItem(channel, program, allChannels),
          ),
        };
      }),
    );

    const now = dayjs();
    this.eventService.push({
      type: 'xmltv',
      message: `XMLTV updated at server time = ${now.format()}`,
      module: 'xmltv',
      detail: {
        time: +now,
      },
      level: 'info',
    });
  }

  private async getChannelGuides(
    dateRange: OpenDateTimeRange,
    channelIdFilter?: string[],
  ) {
    const allChannels = await this.channelDB.getAllChannels();
    const startTime = dateRange.from ?? dayjs();
    const endTime = dateRange.to;
    const lineups = await Promise.all(
      map(
        channelIdFilter
          ? filter(allChannels, (c) => channelIdFilter.includes(c.uuid))
          : allChannels,
        async (channel) => {
          const actualEndTime = endTime
            ? endTime
            : dayjs(startTime.add(channel.guideMinimumDuration, 'seconds'));

          const guideItems =
            (await this.getChannelLineup(
              channel.uuid,
              startTime.toDate(),
              actualEndTime.toDate(),
            )) ?? [];

          return {
            channel,
            programs: guideItems,
          };
        },
      ),
    );

    // Materialize everything...
    const programIds = uniq(
      compact(
        flatMap(lineups, (lineup) =>
          seq.collect(lineup.programs, (program) => {
            if (program.lineupItem.type !== 'content') {
              return;
            }
            return program.lineupItem.id;
          }),
        ),
      ),
    );

    const materializedPrograms = groupByUniqProp(
      await this.programDB.getProgramsByIds(programIds),
      'uuid',
    );

    return map(lineups, ({ channel, programs }) => {
      return {
        icon: channel.icon,
        name: channel.name,
        number: channel.number,
        id: channel.uuid,
        programs: map(programs, (program) => {
          return this.guideItemToProgram(
            channel,
            program,
            this.programConverter.lineupItemToChannelProgram(
              channel,
              program.lineupItem,
              allChannels,
              program.lineupItem.type === 'content'
                ? materializedPrograms[program.lineupItem.id]
                : undefined,
            ),
          );
        }),
      };
    });
  }

  private guideItemToProgram(
    channel: ChannelWithRelations,
    guideItem: GuideItem,
    materializedItem: ChannelProgram | null,
  ) {
    const baseItem = {
      start: guideItem.startTimeMs,
      stop: guideItem.startTimeMs + guideItem.lineupItem.durationMs,
      persisted: true,
      duration: guideItem.lineupItem.durationMs,
    } as const;

    if (isNull(materializedItem)) {
      materializedItem = this.programConverter.offlineLineupItemToProgram(
        channel,
        { type: 'offline', durationMs: guideItem.lineupItem.durationMs },
      );
    }

    const icon = isNonEmptyString(materializedItem.icon)
      ? materializedItem.icon
      : isNonEmptyString(channel.icon?.path)
        ? channel.icon.path
        : makeLocalUrl('/images/tunarr.png');

    return match(materializedItem)
      .returnType<TvGuideProgram>()
      .with({ type: 'flex' }, (flex) => ({
        ...baseItem,
        ...flex,
        type: 'flex',
        icon,
        title: isNonEmptyString(channel.guideFlexTitle)
          ? channel.guideFlexTitle
          : channel.name,
      }))
      .with({ type: 'content' }, (content) => ({
        ...baseItem,
        ...content,
        type: 'content',
      }))
      .with({ type: 'redirect' }, (redirect) => ({
        ...baseItem,
        ...redirect,
        type: 'redirect',
      }))
      .otherwise(() => ({
        ...baseItem,
        type: 'flex',
        icon,
        title: isNonEmptyString(channel.guideFlexTitle)
          ? channel.guideFlexTitle
          : channel.name,
      }));
  }

  private materializeGuideItem(
    channel: RawChannel,
    currentProgram: GuideItem,
    allChannels: RawChannel[],
  ): TvGuideProgram {
    return this.guideItemToProgram(
      channel,
      currentProgram,
      this.programConverter.lineupItemToChannelProgram(
        channel,
        currentProgram.lineupItem,
        allChannels,
      ),
    );
  }

  private async makePlaceholderChannel(): Promise<ChannelPrograms> {
    const currentUpdateTimeMs = +dayjs();
    const fakeChannelId = v4();
    const channel: ChannelWithPrograms = {
      uuid: fakeChannelId,
      name: 'Tunarr',
      icon: {
        path: makeLocalUrl('/images/tunarr.png'),
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
      createdAt: +dayjs(),
      updatedAt: +dayjs(),
      fillerRepeatCooldown: null,
      groupTitle: null,
      watermark: null,
      transcoding: null,
      programs: [],
      streamMode: 'hls',
      transcodeConfigId: (
        await getDatabase()
          .selectFrom('transcodeConfig')
          .select('uuid')
          .executeTakeFirstOrThrow()
      ).uuid,
    };

    // Placeholder channel with random ID.
    return {
      channel: channel,
      programs: [
        {
          startTimeMs:
            currentUpdateTimeMs - (currentUpdateTimeMs % (30 * 60 * 1000)),
          lineupItem: {
            durationMs: 24 * 60 * 60 * 1000,
            type: 'offline',
          },
        },
      ],
    };
  }
}

function isProgramOffline(
  program: Maybe<LineupItem>,
  channel: RawChannel,
): boolean {
  return (
    !isUndefined(program) &&
    (program.type === 'offline' ||
      program.durationMs <=
        (channel.guideMinimumDuration ??
          constants.DEFAULT_GUIDE_STEALTH_DURATION))
  );
}
