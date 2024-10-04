import constants from '@tunarr/shared/constants';
import dayjs from 'dayjs';
import { first, isEmpty, isNil, isNull, isUndefined, nth } from 'lodash-es';
import { StrictExclude } from 'ts-essentials';
import { ChannelDB } from '../dao/channelDb.js';
import { ProgramExternalIdType } from '../dao/custom_types/ProgramExternalIdType.js';
import { getEm } from '../dao/dataSource.js';
import {
  Lineup,
  isContentItem,
  isOfflineItem,
} from '../dao/derived_types/Lineup.js';
import {
  EnrichedLineupItem,
  RedirectStreamLineupItem,
  StreamLineupItem,
  createOfflineStreamLineupItem,
} from '../dao/derived_types/StreamLineup.js';
import { ProgramWithRelations as RawProgramEntity } from '../dao/direct/derivedTypes';
import { Channel } from '../dao/direct/schema/Channel.js';
import { MediaSourceType } from '../dao/entities/MediaSource.js';
import { Program as ProgramEntity } from '../dao/entities/Program.js';
import { ProgramExternalId } from '../dao/entities/ProgramExternalId.js';
import { FillerDB } from '../dao/fillerDB.js';
import { FillerPicker } from '../services/FillerPicker.js';
import { Result } from '../types/result.js';
import { Maybe, Nullable } from '../types/util.js';
import { binarySearchRange } from '../util/binarySearch.js';
import { isNonEmptyString, zipWithIndex } from '../util/index.js';
import { LoggerFactory } from '../util/logging/LoggerFactory.js';
import { ChannelCache } from './ChannelCache.js';
import { wereThereTooManyAttempts } from './StreamThrottler.js';

const SLACK = constants.SLACK;

// Figure out this type later...
export type ProgramAndTimeElapsed = {
  program: EnrichedLineupItem;
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

export class StreamProgramCalculatorError extends Error {
  constructor(
    public type: 'channel_not_found' | 'ffmpeg_missing' | 'no_current_program',
    message?: string,
  ) {
    super(message);
  }
}

export class StreamProgramCalculator {
  private logger = LoggerFactory.child({
    caller: import.meta,
    className: this.constructor.name,
  });

  constructor(
    private fillerDB: FillerDB,
    private channelDB: ChannelDB,
    private channelCache: ChannelCache,
  ) {}

  async getCurrentLineupItem(
    req: GetCurrentLineupItemRequest,
  ): Promise<
    Result<{ lineupItem: StreamLineupItem; channelContext: Channel }>
  > {
    const channel = await this.channelDB.getChannelDirect(req.channelId);

    if (isNil(channel)) {
      return Result.failure(
        new StreamProgramCalculatorError(
          'channel_not_found',
          `Channel ${req.channelId} doesn't exist`,
        ),
      );
    }

    const lineup = await this.channelDB.loadLineup(channel.uuid);

    let lineupItem: Maybe<StreamLineupItem>;
    let channelContext: Channel = channel;
    const redirectChannels: string[] = [];
    const upperBounds: number[] = [];

    let currentProgram = await this.getCurrentProgramAndTimeElapsed(
      req.startTime,
      channel,
      lineup,
    );

    while (
      !isUndefined(currentProgram) &&
      currentProgram.program.type === 'redirect'
    ) {
      redirectChannels.push(channelContext.uuid);
      upperBounds.push(
        currentProgram.program.duration - currentProgram.timeElapsed,
      );

      if (redirectChannels.includes(currentProgram.program.channel)) {
        await this.channelCache.recordPlayback(
          channelContext.uuid,
          req.startTime,
          {
            type: 'error',
            title: 'Error',
            error:
              'Recursive channel redirect found: ' +
              redirectChannels.join(', '),
            duration: 60_000,
            streamDuration: 60_000,
            start: 0,
          },
        );
      }

      const nextChannelId = currentProgram.program.channel;
      const newChannelAndLineup =
        await this.channelDB.loadDirectChannelAndLineup(nextChannelId);

      if (isNil(newChannelAndLineup)) {
        const msg = "Invalid redirect to a channel that doesn't exist";
        this.logger.error(msg);
        currentProgram = {
          program: {
            ...createOfflineStreamLineupItem(60000),
            type: 'error',
            error: msg,
          },
          timeElapsed: 0,
          programIndex: -1,
        };
        continue;
      }

      channelContext = newChannelAndLineup.channel;
      lineupItem = this.channelCache.getCurrentLineupItem(
        channelContext.uuid,
        req.startTime,
      );

      if (!isUndefined(lineupItem)) {
        break;
      } else {
        currentProgram = await this.getCurrentProgramAndTimeElapsed(
          req.startTime,
          channelContext,
          newChannelAndLineup.lineup,
        );
      }
    }

    if (isUndefined(lineupItem)) {
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
        for (let i = 0; i < redirectChannels.length; i++) {
          await this.channelCache.clearPlayback(redirectChannels[i]);
        }

        this.logger.info(
          'Too little time before the filler ends, skip to next slot',
        );

        // return await this.startStream(req, startTimestamp + dt + 1, false);
        return await this.getCurrentLineupItem({
          ...req,
          startTime: req.startTime + dt + 1,
        });
      }
      if (isNil(currentProgram) || isNil(currentProgram.program)) {
        const msg =
          "No video to play, this means there's a serious unexpected bug or the channel db is corrupted.";
        this.logger.error(msg);
        return Result.failure(new Error(msg));
      }

      if (currentProgram.program.type === 'redirect') {
        return Result.failure(new Error('Unable to resolve program redirects'));
      }

      lineupItem = await this.createLineupItem(
        currentProgram.program,
        currentProgram.timeElapsed,
        channelContext,
      );
    }

    if (!isUndefined(lineupItem)) {
      let upperBound = Number.MAX_SAFE_INTEGER;
      const beginningOffset = lineupItem?.beginningOffset ?? 0;

      //adjust upper bounds and record playbacks
      for (let i = redirectChannels.length - 1; i >= 0; i--) {
        const thisUpperBound = nth(upperBounds, i);
        if (!isNil(thisUpperBound)) {
          const nextBound = thisUpperBound + beginningOffset;
          const prevBound = isNil(lineupItem.streamDuration)
            ? upperBound
            : Math.min(upperBound, lineupItem.streamDuration);
          const newDuration = Math.min(nextBound, prevBound);

          lineupItem = {
            ...lineupItem,
            streamDuration: newDuration,
          };
          upperBound = newDuration;
        }

        await this.channelCache.recordPlayback(
          redirectChannels[i],
          req.startTime,
          lineupItem,
        );
      }
    }

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
        start: 0,
      };
    }

    return Result.success({ lineupItem, channelContext });
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
        program: createOfflineStreamLineupItem(channel.startTime - timestamp),
        timeElapsed: 0,
        programIndex: -1,
      };
    }

    let timeElapsed: number;
    let currentProgramIndex: number = -1;

    // This is an optimization. We should have precalculated offsets on the channel
    // We can find the current playing index using binary search on these, just like
    // when creating the TV guide.
    // TODO: We should make this required before v1.0
    if (channelLineup.startTimeOffsets) {
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
    } else {
      // Original logic - this is a fallback now.
      timeElapsed = (timestamp - channel.startTime) % channel.duration;
      for (const [program, index] of zipWithIndex(channelLineup.items)) {
        if (timeElapsed - program.durationMs < 0) {
          // We found the program we are looking for
          currentProgramIndex = index;

          if (
            program.durationMs > 2 * SLACK &&
            timeElapsed > program.durationMs - SLACK
          ) {
            timeElapsed = 0;
            currentProgramIndex = (index + 1) % channelLineup.items.length;
          }
          break;
        } else {
          timeElapsed -= program.durationMs;
        }
      }
    }

    if (currentProgramIndex === -1) {
      throw new Error('No program found; find algorithm messed up');
    }

    const lineupItem = channelLineup.items[currentProgramIndex];
    let program: EnrichedLineupItem;
    if (isContentItem(lineupItem)) {
      // Defer program lookup
      const backingItem = await getEm().findOne(
        ProgramEntity,
        {
          uuid: lineupItem.id,
        },
        {
          populate: ['externalIds'],
          populateWhere: {
            externalIds: {
              sourceType: {
                $in: [
                  ProgramExternalIdType.PLEX,
                  ProgramExternalIdType.JELLYFIN,
                ],
              },
            },
          },
        },
      );

      program = {
        duration: lineupItem.durationMs,
        type: 'offline',
      };

      if (!isNil(backingItem)) {
        // Will play this item on the first found server... unsure if that is
        // what we want
        const externalInfo = backingItem.externalIds.find(
          (eid) =>
            eid.sourceType === ProgramExternalIdType.PLEX ||
            eid.sourceType === ProgramExternalIdType.JELLYFIN,
        );

        if (
          !isUndefined(externalInfo) &&
          isNonEmptyString(externalInfo.externalSourceId)
        ) {
          program = {
            type: 'program',
            externalSource:
              externalInfo.sourceType === ProgramExternalIdType.JELLYFIN
                ? MediaSourceType.Jellyfin
                : MediaSourceType.Plex,
            plexFilePath: externalInfo.externalFilePath,
            externalKey: externalInfo.externalKey,
            filePath: externalInfo.directFilePath,
            externalSourceId: externalInfo.externalSourceId,
            duration: backingItem.duration,
            programId: backingItem.uuid,
            title: backingItem.title,
            id: backingItem.uuid,
            programType: backingItem.type,
          };
        }
      }
    } else if (isOfflineItem(lineupItem)) {
      program = {
        duration: lineupItem.durationMs,
        type: 'offline',
      };
    } else {
      program = {
        duration: lineupItem.durationMs,
        channel: lineupItem.channel,
        type: 'redirect',
      };
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
    activeProgram: StrictExclude<EnrichedLineupItem, RedirectStreamLineupItem>,
    timeElapsed: number,
    channel: Channel,
  ): Promise<StreamLineupItem> {
    // Start time of a file is never consistent unless 0. Run time of an episode can vary.
    // When within 30 seconds of start time, just make the time 0 to smooth things out
    // Helps prevents losing first few seconds of an episode upon lineup change
    let beginningOffset = 0;

    if (activeProgram.type === 'error') {
      const remaining = activeProgram.duration - timeElapsed;
      return {
        type: 'error',
        title: 'Error',
        error: activeProgram.error,
        streamDuration: remaining,
        duration: remaining,
        start: 0,
        beginningOffset: beginningOffset,
      };
    }

    if (activeProgram.type === 'offline') {
      //offline case
      let remaining = activeProgram.duration - timeElapsed;
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
      const randomResult = new FillerPicker().pickRandomWithMaxDuration(
        channel,
        fillerPrograms,
        remaining,
      );
      filler = randomResult.filler;

      // Cap the filler at remaining time
      if (isNil(filler) && remaining > randomResult.minimumWait) {
        remaining = randomResult.minimumWait;
      }

      // If we could not find a configured filler program, try to use the
      // fallback.
      let isSpecial = false;
      if (isNil(filler)) {
        filler = fallbackProgram;
        isSpecial = true;
      }

      if (!isNil(filler)) {
        let fillerstart = 0;
        // If we have a special, push it on the lineup
        if (isSpecial) {
          if (filler.duration > remaining) {
            fillerstart = filler.duration - remaining;
          } else {
            fillerstart = 0;
          }
        }

        const externalInfos = await getEm().find(ProgramExternalId, {
          program: { uuid: filler.uuid },
          sourceType: {
            $in: [ProgramExternalIdType.PLEX, ProgramExternalIdType.JELLYFIN],
          },
        });

        if (!isEmpty(externalInfos)) {
          const externalInfo = first(externalInfos)!;
          return {
            // just add the video, starting at 0, playing the entire duration
            type: 'commercial',
            title: filler.title,
            filePath: externalInfo.directFilePath,
            externalKey: externalInfo.externalKey,
            externalSource:
              externalInfo.sourceType === ProgramExternalIdType.JELLYFIN
                ? MediaSourceType.Jellyfin
                : MediaSourceType.Plex,
            start: fillerstart,
            streamDuration: Math.max(
              1,
              Math.min(filler.duration - fillerstart, remaining),
            ),
            duration: filler.duration,
            programId: filler.uuid,
            beginningOffset: beginningOffset,
            externalSourceId: externalInfo.externalSourceId!,
            plexFilePath: externalInfo.externalFilePath,
            programType: filler.type,
          };
        }
      }

      // pick the offline screen
      remaining = Math.min(remaining, 10 * 60 * 1000);
      //don't display the offline screen for longer than 10 minutes. Maybe the
      //channel's admin might change the schedule during that time and then
      //it would be better to start playing the content.
      return {
        type: 'offline',
        title: 'Channel Offline',
        streamDuration: remaining,
        beginningOffset: beginningOffset,
        duration: remaining,
        start: 0,
      };
    }

    const originalTimeElapsed = timeElapsed;
    if (timeElapsed < 30000) {
      timeElapsed = 0;
    }
    beginningOffset = Math.max(0, originalTimeElapsed - timeElapsed);

    return {
      ...activeProgram,
      type: 'program',
      start: timeElapsed,
      streamDuration: activeProgram.duration - timeElapsed,
      beginningOffset: beginningOffset,
      id: activeProgram.id,
    };
  }
}
