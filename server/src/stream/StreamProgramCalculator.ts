import { ProgramExternalIdType } from '@/db/custom_types/ProgramExternalIdType.js';
import { Channel } from '@/db/schema/Channel.js';
import type { ProgramWithRelations as RawProgramEntity } from '@/db/schema/derivedTypes.js';
import { KEYS } from '@/types/inject.js';
import { Result } from '@/types/result.js';
import { Maybe, Nullable } from '@/types/util.js';
import { binarySearchRange } from '@/util/binarySearch.js';
import { type Logger } from '@/util/logging/LoggerFactory.js';
import constants from '@tunarr/shared/constants';
import dayjs from 'dayjs';
import { inject, injectable } from 'inversify';
import { first, isEmpty, isNil, isNull } from 'lodash-es';
import { Lineup } from '../db/derived_types/Lineup.ts';
import {
  CommercialStreamLineupItem,
  ProgramStreamLineupItem,
  StreamLineupItem,
  createOfflineStreamLineupItem,
} from '../db/derived_types/StreamLineup.ts';
import { IChannelDB } from '../db/interfaces/IChannelDB.ts';
import { IFillerListDB } from '../db/interfaces/IFillerListDB.ts';
import { IProgramDB } from '../db/interfaces/IProgramDB.ts';
import { IStreamLineupCache } from '../interfaces/IStreamLineupCache.ts';
import { IFillerPicker } from '../services/interfaces/IFillerPicker.ts';
import { WrappedError } from '../types/errors.ts';
import { isNonEmptyString } from '../util/index.js';
import { wereThereTooManyAttempts } from './StreamThrottler.js';

const SLACK = constants.SLACK;

// Figure out this type later...
export type ProgramAndTimeElapsed = {
  program: StreamLineupItem;
  timeElapsed: number;
  programIndex: number;
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
  channelContext: Channel;
  sourceChannel: Channel;
};

@injectable()
export class StreamProgramCalculator {
  constructor(
    @inject(KEYS.Logger) private logger: Logger,
    @inject(KEYS.FillerListDB) private fillerDB: IFillerListDB,
    @inject(KEYS.ChannelDB) private channelDB: IChannelDB,
    @inject(KEYS.ChannelCache) private channelCache: IStreamLineupCache,
    @inject(KEYS.ProgramDB) private programDB: IProgramDB,
    @inject(KEYS.FillerPicker) private fillerPicker: IFillerPicker,
  ) {}

  async getCurrentLineupItem(
    req: GetCurrentLineupItemRequest,
  ): Promise<Result<CurrentLineupItemResult>> {
    const startTime = req.startTime;
    const channel = await this.channelDB.getChannel(req.channelId);

    if (isNil(channel)) {
      return Result.failure(
        new StreamProgramCalculatorError(
          'channel_not_found',
          `Channel ${req.channelId} doesn't exist`,
        ),
      );
    }

    const lineup = await this.channelDB.loadLineup(channel.uuid);

    // if (lineup.onDemandConfig) {
    //   startTime = this.onDemandService.getLiveTimestampForConfig(
    //     lineup.onDemandConfig,
    //     channel.startTime,
    //     startTime,
    //   );
    // }

    let lineupItem: Maybe<StreamLineupItem>;
    let channelContext: Channel = channel;
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
        await this.channelCache.recordPlayback(channelContext.uuid, startTime, {
          type: 'error',
          error:
            'Recursive channel redirect found: ' + redirectChannels.join(', '),
          duration: 60_000,
          streamDuration: 60_000,
          startOffset: 0,
          programBeginMs: req.startTime,
        });
      }

      const nextChannelId = currentProgram.program.channel;
      const newChannelAndLineup =
        await this.channelDB.loadChannelAndLineup(nextChannelId);

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
      // lineupItem = this.channelCache.getCurrentLineupItem(
      //   channelContext.uuid,
      //   req.startTime,
      // );

      // if (lineupItem) {
      //   const newItemEndTime = lineupItem.programBeginMs + lineupItem.duration;
      //   if (newItemEndTime < endTimeMs) {
      //     streamDuration = newItemEndTime - req.startTime;
      //   }

      //   break;
      // } else {
      // }
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
      );
    }

    // if (lineupItem) {
    //   let upperBound = Number.MAX_SAFE_INTEGER;
    //   const beginningOffset = lineupItem?.beginningOffset ?? 0;

    //   //adjust upper bounds and record playbacks
    //   for (let i = redirectChannels.length - 1; i >= 0; i--) {
    //     const thisUpperBound = nth(upperBounds, i);
    //     if (!isNil(thisUpperBound)) {
    //       const nextBound = thisUpperBound + beginningOffset;
    //       const prevBound = isNil(lineupItem.streamDuration)
    //         ? upperBound
    //         : Math.min(upperBound, lineupItem.streamDuration);
    //       const newDuration = Math.min(nextBound, prevBound);

    //       lineupItem = {
    //         ...lineupItem,
    //         streamDuration: newDuration,
    //       };
    //       upperBound = newDuration;
    //     }

    //     await this.channelCache.recordPlayback(
    //       redirectChannels[i],
    //       req.startTime,
    //       lineupItem,
    //     );
    //   }
    // }

    await this.channelCache.recordPlayback(
      channel.uuid,
      req.startTime,
      lineupItem,
    );

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

    let timeElapsed: number;
    let currentProgramIndex: number = -1;

    // This is an optimization. We should have precalculated offsets on the channel
    // We can find the current playing index using binary search on these, just like
    // when creating the TV guide.
    const timeSinceStart = timestamp - channel.startTime;
    // How far into the current program cycle are we.
    const elapsed =
      timeSinceStart < channel.duration
        ? timeSinceStart
        : timeSinceStart % channel.duration;

    const programIndex =
      channelLineup.startTimeOffsets.length === 1
        ? 0
        : binarySearchRange(channelLineup.startTimeOffsets, elapsed);

    if (!isNull(programIndex)) {
      currentProgramIndex = programIndex;
      const foundOffset = channelLineup.startTimeOffsets[programIndex];
      // Mark how far 'into' the channel we are.
      timeElapsed = elapsed - foundOffset;
      const program = channelLineup.items[programIndex];
      if (timeElapsed > program.durationMs - SLACK) {
        // Go to the next program if we're very close to the end
        // of the current one. No sense in starting a brand new
        // stream for a couple of seconds.
        timeElapsed = 0;
        currentProgramIndex = (programIndex + 1) % channelLineup.items.length;
      }
    } else {
      // Throw below.
      timeElapsed = 0;
      currentProgramIndex = -1;
    }

    if (currentProgramIndex === -1) {
      throw new Error('No program found; find algorithm messed up');
    }

    const currOffset = channelLineup.startTimeOffsets[currentProgramIndex];
    const nextOffset =
      currOffset +
      channelLineup.items[
        (currentProgramIndex + 1) % channelLineup.items.length
      ].durationMs;

    const streamDuration = nextOffset - currOffset - elapsed;

    const lineupItem = channelLineup.items[currentProgramIndex];
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
          // const mediaSourceType = match(externalInfo.sourceType)
          //   .with(ProgramExternalIdType.PLEX, () => MediaSourceType.Plex)
          //   .with(
          //     ProgramExternalIdType.JELLYFIN,
          //     () => MediaSourceType.Jellyfin,
          //   )
          //   .with(ProgramExternalIdType.EMBY, () => MediaSourceType.Emby)
          //   .otherwise(() => null);
          // if (!mediaSourceType) {
          //   throw new Error('Impossible');
          // }

          const baseItem = {
            // externalSource: backingItem.sourceType,
            // plexFilePath: nullToUndefined(externalInfo?.externalFilePath),
            // externalKey: externalInfo.externalKey,
            // filePath: nullToUndefined(externalInfo?.directFilePath),
            // externalSourceId: backingItem.mediaSourceId,
            // contentDuration: backingItem.duration,
            duration: lineupItem.durationMs,
            // programId: backingItem.uuid,
            // title: backingItem.title,
            // programType: backingItem.type,
            program: { ...backingItem, mediaSourceId },
            programBeginMs: timestamp - timeElapsed,
            streamDuration,
          };

          if (isNonEmptyString(lineupItem.fillerListId)) {
            program = {
              ...baseItem,
              type: 'commercial',
              fillerId: lineupItem.fillerListId,
              infiniteLoop: backingItem.duration < streamDuration,
            } satisfies CommercialStreamLineupItem;
          } else {
            program = {
              ...baseItem,
              type: 'program',
              infiniteLoop: false,
            } satisfies ProgramStreamLineupItem;
          }
        } else if (backingItem) {
          this.logger.error(
            'Found a backing item with id %s, but it had no mediaSourceId, which is very bad! This is a bug.',
            backingItem.uuid,
          );
        }
        break;
      }
      case 'offline': {
        program = {
          ...createOfflineStreamLineupItem(lineupItem.durationMs, timestamp),
          programBeginMs: timestamp - timeElapsed,
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

  // The naming is also kinda terrible - maybe it changed over time? This function seems to do one of:
  // 1. If the current item is an error item, return it with the time remaining until next up
  // 2. If the current program is "offline" type, try to pick best fitting content among fillter
  // 2b. If no fillter content is found, then pad with more offline time
  // 3. Return the currently playing "real" program
  async createLineupItem(
    { program, timeElapsed }: ProgramAndTimeElapsed,
    streamDuration: number,
    channel: Channel,
  ): Promise<StreamLineupItem> {
    if (program.type === 'redirect') {
      throw new Error(
        'Should be impossible. Redirects must be resolved before calling this method',
      );
    }

    timeElapsed = Math.round(timeElapsed);

    if (program.type === 'error') {
      return {
        type: 'error',
        // title: 'Error',
        error: program.error,
        streamDuration,
        duration: streamDuration,
        startOffset: 0,
        // beginningOffset,
        programBeginMs: program.programBeginMs,
      };
    }

    if (program.type === 'offline') {
      //offline case
      //look for a random filler to play
      const fillerPrograms = await this.fillerDB.getFillersFromChannel(
        channel.uuid,
      );

      let filler: Nullable<RawProgramEntity>;
      let fallbackProgram: Nullable<RawProgramEntity> = null;

      // See if we have any fallback programs set
      const fallbackPrograms = await this.channelDB.getChannelFallbackPrograms(
        channel.uuid,
      );
      if (channel.offline?.mode === 'clip' && !isEmpty(fallbackPrograms)) {
        fallbackProgram = first(fallbackPrograms)!;
      }

      // Pick a random filler, too
      const randomResult = this.fillerPicker.pickFiller(
        channel,
        fillerPrograms,
        streamDuration,
      );
      filler = randomResult.filler;

      // Cap the filler at remaining time
      if (isNil(filler) && streamDuration > randomResult.minimumWait) {
        streamDuration = randomResult.minimumWait;
      }

      // If we could not find a configured filler program, try to use the
      // fallback.
      let isSpecial = false;
      if (isNil(filler)) {
        filler = fallbackProgram;
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

        const externalInfos = await this.programDB.getProgramExternalIds(
          filler.uuid,
          [
            ProgramExternalIdType.PLEX,
            ProgramExternalIdType.JELLYFIN,
            ProgramExternalIdType.EMBY,
          ],
        );

        if (
          !isEmpty(externalInfos) &&
          isNonEmptyString(first(externalInfos)?.mediaSourceId)
        ) {
          streamDuration = Math.max(
            1,
            Math.min(filler.duration - fillerstart, streamDuration),
          );
          const startOffset = Math.round(fillerstart);

          return {
            // just add the video, starting at 0, playing the entire duration
            type: 'commercial',
            program: {
              ...fillerProgram,
              mediaSourceId,
            },
            // title: filler.title,
            // filePath: nullToUndefined(externalInfo.directFilePath),
            // externalKey: externalInfo.externalKey,
            // externalSource:
            //   externalInfo.sourceType === ProgramExternalIdType.JELLYFIN
            //     ? MediaSourceType.Jellyfin
            //     : MediaSourceType.Plex,
            startOffset,
            streamDuration,
            // contentDuration: filler.duration,
            duration: program.duration,
            // programId: filler.uuid,
            // externalSourceId: externalInfo.mediaSourceId!,
            // plexFilePath: nullToUndefined(externalInfo.externalFilePath),
            // programType: filler.type,
            programBeginMs: program.programBeginMs,
            fillerId: filler.uuid,
            infiniteLoop: filler.duration < streamDuration,
          } satisfies CommercialStreamLineupItem;
        }
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

    if (program.type === 'commercial') {
      return {
        ...program,
        startOffset: timeElapsed,
        streamDuration,
      };
    }

    return {
      ...program,
      type: 'program',
      startOffset: timeElapsed,
      streamDuration,
    };
  }
}
