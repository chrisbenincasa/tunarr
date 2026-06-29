import type { ChannelOrm } from '@/db/schema/Channel.js';
import type { ProgramOrmWithExternalIds } from '@/db/schema/derivedTypes.js';
import { KEYS } from '@/types/inject.js';
import { Result } from '@/types/result.js';
import type { Maybe, Nullable } from '@/types/util.js';
import { binarySearchRange } from '@/util/binarySearch.js';
import { InjectLogger } from '@/util/inject.js';
import { type Logger } from '@/util/logging/LoggerFactory.js';
import constants from '@tunarr/shared/constants';
import dayjs from 'dayjs';
import { inject, injectable } from 'inversify';
import { inRange, isNil, isNull, sumBy } from 'lodash-es';
import type { Lineup, LineupItem } from '../db/derived_types/Lineup.ts';
import type {
  CommercialStreamLineupItem,
  FallbackStreamLineupItem,
  ProgramStreamLineupItem,
  StreamLineupItem} from '../db/derived_types/StreamLineup.ts';
import {
  createOfflineStreamLineupItem,
  isContentBackedLineupItem
} from '../db/derived_types/StreamLineup.ts';
import type { IChannelDB } from '../db/interfaces/IChannelDB.ts';
import type { IFillerListDB } from '../db/interfaces/IFillerListDB.ts';
import type { IProgramDB } from '../db/interfaces/IProgramDB.ts';
import { ProgramPlayHistoryDB } from '../db/ProgramPlayHistoryDB.ts';
import { OneDayMillis } from '../ffmpeg/builder/constants.ts';
import type { IFillerPicker } from '../services/interfaces/IFillerPicker.ts';
import { WrappedError } from '../types/errors.ts';
import { devAssert } from '../util/debug.ts';
import { isNonEmptyString } from '../util/index.js';
import { wereThereTooManyAttempts } from './StreamThrottler.js';

const SLACK = constants.SLACK;

// Figure out this type later...
export type ProgramAndTimeElapsed = {
  program: StreamLineupItem;
  timeElapsed: number;
  programIndex: number;
  contentStartOffsetMs?: number;
};

// Taking advantage of structural typing for transition
// to Kysely querying...
type MinimalChannelDetails = {
  startTime: number;
  duration: number;
};

export type GetCurrentLineupItemRequest = {
  channelId: string | number;
  startTime: number;
  allowSkip: boolean;
  sessionToken?: string;
};

export class StreamProgramCalculatorError extends WrappedError {
  constructor(
    public type: 'channel_not_found' | 'ffmpeg_missing' | 'no_current_program',
    message?: string,
  ) {
    super(message);
  }
}

export type CurrentLineupItemResult = {
  lineupItem: StreamLineupItem;
  // Either the source channel or the target channel
  // if the current program is a redirect
  channelContext: ChannelOrm;
  sourceChannel: ChannelOrm;
};

@injectable()
export class StreamProgramCalculator {
  @InjectLogger() private declare readonly logger: Logger;

  constructor(
    @inject(KEYS.FillerListDB) private fillerDB: IFillerListDB,
    @inject(KEYS.ChannelDB) private channelDB: IChannelDB,
    @inject(KEYS.ProgramDB) private programDB: IProgramDB,
    @inject(KEYS.FillerPicker)
    private fillerPicker: IFillerPicker,
    @inject(ProgramPlayHistoryDB)
    private programPlayHistoryDB: ProgramPlayHistoryDB,
  ) {}

  async getCurrentLineupItem(
    req: GetCurrentLineupItemRequest,
  ): Promise<Result<CurrentLineupItemResult>> {
    const startTime = req.startTime;
    const channel = await this.channelDB.getChannelOrm(req.channelId);

    if (isNil(channel)) {
      return Result.failure(
        new StreamProgramCalculatorError(
          'channel_not_found',
          `Channel ${req.channelId} doesn't exist`,
        ),
      );
    }

    const lineup = await this.channelDB.loadLineup(channel.uuid);

    // Fix channel lineups if necessary
    if (channel.duration <= 0) {
      const actualDuration = sumBy(lineup.items, (item) => item.durationMs);
      await this.channelDB.updateChannelDuration(channel.uuid, actualDuration);
      channel.duration = actualDuration;
    }

    let lineupItem: Maybe<StreamLineupItem>;
    let channelContext: ChannelOrm = channel;
    const redirectChannels: string[] = [];
    const upperBounds: number[] = [];

    let currentProgram = await this.getCurrentProgramAndTimeElapsed(
      startTime,
      channel,
      lineup,
    );
    // We cannot exceed this amount of time, since that is what was scheduled
    // on the channel.
    const maxDuration =
      currentProgram.program.duration - currentProgram.timeElapsed;
    const endTimeMs = req.startTime + maxDuration;
    let streamDuration = maxDuration;

    while (currentProgram.program.type === 'redirect') {
      redirectChannels.push(channelContext.uuid);
      upperBounds.push(
        currentProgram.program.duration - currentProgram.timeElapsed,
      );

      if (redirectChannels.includes(currentProgram.program.channel)) {
        return Result.failure(
          `Recursive channel redirect found: ${redirectChannels.join(' -> ')} -> ${currentProgram.program.channel}`,
        );
      }

      const nextChannelId = currentProgram.program.channel;
      const newChannelAndLineup =
        await this.channelDB.loadChannelAndLineupOrm(nextChannelId);

      if (isNil(newChannelAndLineup)) {
        const msg = "Invalid redirect to a channel that doesn't exist";
        this.logger.error(msg);
        currentProgram = {
          program: {
            ...createOfflineStreamLineupItem(60000, req.startTime),
            type: 'error',
            error: msg,
          },
          timeElapsed: 0,
          programIndex: -1,
        };
        continue;
      }

      channelContext = newChannelAndLineup.channel;

      currentProgram = await this.getCurrentProgramAndTimeElapsed(
        req.startTime,
        channelContext,
        newChannelAndLineup.lineup,
      );

      const timeLeft =
        currentProgram.program.duration - currentProgram.timeElapsed;
      const newEndTime = req.startTime + timeLeft;
      if (newEndTime < endTimeMs) {
        streamDuration = newEndTime - req.startTime;
        currentProgram.program.streamDuration = streamDuration;
      }
    }

    if (!lineupItem) {
      if (isNil(currentProgram)) {
        return Result.failure(
          new StreamProgramCalculatorError(
            'no_current_program',
            'Could not find currentProgram for channel',
          ),
        );
      }

      if (
        currentProgram.program.type === 'offline' &&
        lineup.items.length === 1 &&
        currentProgram.programIndex !== -1
      ) {
        //there's only one program and it's offline. So really, the channel is
        //permanently offline, it doesn't matter what duration was set
        //and it's best to give it a long duration to ensure there's always
        //filler to play (if any)
        currentProgram.program = createOfflineStreamLineupItem(
          dayjs.duration({ years: 1 }).asMilliseconds(),
          req.startTime,
        );
      } else if (
        req.allowSkip &&
        currentProgram.program.type === 'offline' &&
        currentProgram.program.duration - currentProgram.timeElapsed <=
          constants.SLACK + 1
      ) {
        //it's pointless to show the offline screen for such a short time, might as well
        //skip to the next program
        const dt = currentProgram.program.duration - currentProgram.timeElapsed;

        this.logger.debug(
          'Too little time before the filler ends, skip to next slot',
        );

        return await this.getCurrentLineupItem({
          ...req,
          startTime: req.startTime + dt + 1,
        });
      }
      if (isNil(currentProgram) || isNil(currentProgram.program)) {
        const msg =
          "No video to play, this means there's a serious unexpected bug or the channel db is corrupted.";
        this.logger.error(msg);
        return Result.forError(new Error(msg));
      }

      lineupItem = await this.createLineupItem(
        currentProgram,
        streamDuration,
        channelContext,
        startTime,
      );
      this.logger.trace('Got lineup item: %O', lineupItem);
    }

    // Record play history for content-backed items (programs and commercials/fillers)
    // Only record if this is a new playback (not a duplicate request for an already-playing program)
    if (
      isContentBackedLineupItem(lineupItem) &&
      lineupItem.type !== 'fallback'
    ) {
      const programUuid = lineupItem.program.uuid;
      const fillerListId =
        lineupItem.type === 'commercial' ? lineupItem.fillerListId : undefined;
      const streamDuration = lineupItem.streamDuration;
      const channelUuid = channel.uuid;
      const playedAt = new Date(req.startTime);

      try {
        const isCurrentlyPlaying =
          await this.programPlayHistoryDB.isProgramCurrentlyPlaying(
            channelUuid,
            programUuid,
            req.startTime,
          );
        if (!isCurrentlyPlaying) {
          await this.programPlayHistoryDB.create({
            programUuid,
            channelUuid,
            playedAt,
            playedDuration: streamDuration,
            fillerListId,
          });
        }
      } catch (err) {
        this.logger.error(
          err,
          'Failed to record play history for program %s on channel %s (filler list id = %s)',
          programUuid,
          channelUuid,
          fillerListId ?? 'null',
        );
      }
    }

    if (
      req.sessionToken &&
      wereThereTooManyAttempts(req.sessionToken, lineupItem)
    ) {
      lineupItem = {
        type: 'error',
        error: 'Too many attempts, throttling',
        duration: 60_000,
        startOffset: 0,
        programBeginMs: req.startTime,
        streamDuration,
      };
    }

    return Result.success({
      lineupItem,
      channelContext,
      sourceChannel: channel,
    });
  }

  // This code is almost identical to TvGuideService#getCurrentPlayingIndex
  private async getCurrentProgramAndTimeElapsed(
    timestamp: number,
    channel: MinimalChannelDetails,
    channelLineup: Lineup,
  ): Promise<ProgramAndTimeElapsed> {
    if (channel.startTime > timestamp) {
      this.logger.debug(
        'Channel start time is above the given date. Flex time is picked till that.',
      );
      return {
        program: createOfflineStreamLineupItem(
          channel.startTime - timestamp,
          timestamp,
        ),
        timeElapsed: 0,
        programIndex: -1,
      };
    }

    const { streamDuration, timeElapsed, currentProgramIndex } =
      calculateStreamDuration(
        timestamp,
        channel.startTime,
        channel.duration,
        channelLineup,
      );

    let lineupItem: LineupItem;
    if (inRange(currentProgramIndex, 0, channelLineup.items.length)) {
      lineupItem = channelLineup.items[currentProgramIndex]!;
    } else {
      lineupItem = {
        type: 'offline',
        durationMs: OneDayMillis,
      };
    }

    let program: StreamLineupItem;
    switch (lineupItem.type) {
      case 'content': {
        // Defer program lookup
        const backingItem = await this.programDB.getProgramById(lineupItem.id);

        program = {
          duration: lineupItem.durationMs,
          type: 'offline',
          programBeginMs: timestamp - timeElapsed,
          streamDuration,
        };

        if (backingItem && isNonEmptyString(backingItem.mediaSourceId)) {
          const mediaSourceId = backingItem.mediaSourceId;
          const baseItem = {
            duration: lineupItem.durationMs,
            program: { ...backingItem, mediaSourceId },
            programBeginMs: timestamp - timeElapsed,
            streamDuration,
          };

          if (isNonEmptyString(lineupItem.fillerListId)) {
            program = {
              ...baseItem,
              type: 'commercial',
              fillerListId: lineupItem.fillerListId,
              infiniteLoop: backingItem.duration < streamDuration,
              startOffset: lineupItem.startOffsetMs ?? 0,
            } satisfies CommercialStreamLineupItem;
          } else {
            program = {
              ...baseItem,
              type: 'program',
              infiniteLoop: false,
              startOffset: lineupItem.startOffsetMs ?? 0,
            } satisfies ProgramStreamLineupItem;
          }
        } else if (backingItem) {
          this.logger.error(
            'Found a backing item with id %s, but it had no mediaSourceId, which is very bad! This is a bug.',
            backingItem.uuid,
          );
        }

        return {
          program,
          timeElapsed,
          programIndex: currentProgramIndex,
          contentStartOffsetMs: lineupItem.startOffsetMs,
        };
      }
      case 'offline': {
        program = {
          ...createOfflineStreamLineupItem(lineupItem.durationMs, timestamp),
          programBeginMs: timestamp - timeElapsed,
          fillerConfig: lineupItem.fillerConfig,
        };
        break;
      }

      case 'redirect': {
        program = {
          duration: lineupItem.durationMs,
          channel: lineupItem.channel,
          type: 'redirect',
          programBeginMs: timestamp - timeElapsed,
          streamDuration,
        };
        break;
      }
    }

    return {
      program,
      timeElapsed,
      programIndex: currentProgramIndex,
    };
  }

  async createLineupItem(
    { program, timeElapsed, contentStartOffsetMs }: ProgramAndTimeElapsed,
    streamDuration: number,
    channel: ChannelOrm,
    effectiveNow: number,
  ): Promise<StreamLineupItem> {
    if (program.type === 'redirect') {
      throw new Error(
        'Should be impossible. Redirects must be resolved before calling this method',
      );
    }

    timeElapsed = Math.round(timeElapsed);

    if (program.type === 'error') {
      const item = {
        type: 'error',
        // title: 'Error',
        error: program.error,
        streamDuration,
        duration: streamDuration,
        startOffset: 0,
        // beginningOffset,
        programBeginMs: program.programBeginMs,
      } satisfies StreamLineupItem;
      this.logger.trace('Playing error stream: %O', item);
      return item;
    }

    if (program.type === 'offline') {
      //offline case
      //look for a random filler to play
      const fillerConfig = program.fillerConfig;
      let fillerPrograms = await this.fillerDB.getFillersFromChannel(
        channel.uuid,
      );

      // Filter by allowed filler lists if configured
      if (fillerConfig?.fillerListIds?.length) {
        const allowedIds = new Set(fillerConfig.fillerListIds);
        fillerPrograms = fillerPrograms.filter((f) =>
          allowedIds.has(f.fillerShowUuid),
        );
      }

      let filler: Nullable<ProgramOrmWithExternalIds> = null;
      let fillerListId: Nullable<string> = null;
      let fallbackProgram: Nullable<ProgramOrmWithExternalIds> = null;

      // See if we have any fallback programs set
      const channelFallback = await this.channelDB.getChannelFallbackPrograms(
        channel.uuid,
      );
      if (channel.offline?.mode === 'clip' && channelFallback) {
        fallbackProgram = channelFallback;
      }

      // Pick a random filler, too
      const randomResult = await this.fillerPicker.pickFiller(
        channel,
        fillerPrograms,
        streamDuration,
        effectiveNow,
        fillerConfig
          ? {
              fillerRepeatCooldownOverrideMs:
                fillerConfig.fillerRepeatCooldownMs,
              fillerListCooldownOverrides:
                fillerConfig.fillerListCooldownOverrides,
            }
          : undefined,
      );
      this.logger.trace('Got filler picker result: %O', randomResult);
      filler = randomResult.filler;
      fillerListId = randomResult.fillerListId;

      // Cap the filler at remaining time
      if (isNil(filler) && streamDuration > randomResult.minimumWait) {
        streamDuration = randomResult.minimumWait;
      }

      // If we could not find a configured filler program, try to use the
      // fallback.
      let isSpecial = false;
      if (isNil(filler)) {
        filler = fallbackProgram;
        fillerListId = null;
        isSpecial = true;
      }

      if (!isNil(filler)) {
        // TODO: This stinks right now, but re-materialize the program
        // to get the shiny new type.
        const fillerProgram = await this.programDB.getProgramById(filler.uuid);
        if (!fillerProgram) {
          throw new Error(`Expected program with ID ${filler.uuid}`);
        } else if (!isNonEmptyString(fillerProgram.mediaSourceId)) {
          throw new Error(
            `Expected program with media source ID when querying program ID ${filler.uuid}`,
          );
        }
        const mediaSourceId = fillerProgram.mediaSourceId;
        let fillerstart = 0;
        // If we have a special, push it on the lineup
        if (isSpecial) {
          if (filler.duration > streamDuration) {
            fillerstart = filler.duration - streamDuration;
          } else {
            fillerstart = 0;
          }
        }

        streamDuration = Math.max(
          1,
          Math.min(filler.duration - fillerstart, streamDuration),
        );
        const startOffset = Math.round(fillerstart);

        const base = {
          program: {
            ...fillerProgram,
            mediaSourceId,
          },
          startOffset,
          streamDuration,
          duration: program.duration,
          programBeginMs: program.programBeginMs,
          fillerListId: fillerListId,
          infiniteLoop: filler.duration < streamDuration,
        };

        if (isSpecial || !fillerListId) {
          return {
            ...base,
            type: 'fallback',
          } satisfies FallbackStreamLineupItem;
        }

        return {
          ...base,
          // just add the video, starting at 0, playing the entire duration
          type: 'commercial',
          fillerListId,
          infiniteLoop: filler.duration < streamDuration,
        } satisfies CommercialStreamLineupItem;
      }

      // pick the offline screen
      streamDuration = Math.min(streamDuration, 10 * 60 * 1000);
      //don't display the offline screen for longer than 10 minutes. Maybe the
      //channel's admin might change the schedule during that time and then
      //it would be better to start playing the content.
      return {
        type: 'offline',
        streamDuration,
        // beginningOffset,
        duration: streamDuration,
        startOffset: 0,
        programBeginMs: program.programBeginMs,
      };
    }

    const mediaStartOffset = timeElapsed + (contentStartOffsetMs ?? 0);

    if (program.type === 'commercial') {
      return {
        ...program,
        startOffset: mediaStartOffset + (program.startOffset ?? 0),
        streamDuration,
      };
    }

    return {
      ...program,
      type: 'program',
      startOffset: mediaStartOffset + (program.startOffset ?? 0),
      streamDuration,
    };
  }
}

export function calculateStreamDuration(
  now: number,
  channelStartTime: number,
  channelDuration: number,
  lineup: Lineup,
  slackAmount: number = SLACK,
) {
  devAssert(now >= channelStartTime);
  if (lineup.items.length === 0) {
    return {
      streamDuration: OneDayMillis,
      timeElapsed: 0,
      currentProgramIndex: -1,
    };
  }
  let timeElapsed: number;
  let currentProgramIndex: number = -1;

  // This is an optimization. We should have precalculated offsets on the channel
  // We can find the current playing index using binary search on these, just like
  // when creating the TV guide.
  const timeSinceStart = now - channelStartTime;
  // How far into the current program cycle are we.
  const elapsed =
    timeSinceStart < channelDuration
      ? timeSinceStart
      : timeSinceStart % channelDuration;

  const programIndex =
    lineup.startTimeOffsets.length === 1
      ? 0
      : binarySearchRange(lineup.startTimeOffsets, elapsed, true);

  if (!isNull(programIndex)) {
    currentProgramIndex = programIndex;
    const foundOffset = lineup.startTimeOffsets[programIndex]!;
    // Mark how far 'into' the program we are.
    timeElapsed = elapsed - foundOffset;
    const program = lineup.items[programIndex]!;
    if (timeElapsed > program.durationMs - slackAmount) {
      // Go to the next program if we're very close to the end
      // of the current one. No sense in starting a brand new
      // stream for a couple of seconds.
      timeElapsed = 0;
      currentProgramIndex = (programIndex + 1) % lineup.items.length;
    }
  } else {
    // Throw below.
    timeElapsed = 0;
    currentProgramIndex = -1;
  }

  if (currentProgramIndex === -1) {
    throw new Error('No program found; find algorithm messed up');
  }

  const currOffset = lineup.startTimeOffsets[currentProgramIndex]!;
  const nextOffset = currOffset + lineup.items[currentProgramIndex]!.durationMs;

  return {
    streamDuration: nextOffset - currOffset - timeElapsed,
    timeElapsed,
    currentProgramIndex,
  };
}
