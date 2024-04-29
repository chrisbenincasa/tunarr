import { EntityDTO, Loaded, wrap } from '@mikro-orm/core';
import constants from '@tunarr/shared/constants';
import { every, first, isNil, isNull, negate, pick } from 'lodash-es';
import { getEm } from '../dao/dataSource.js';
import {
  Lineup,
  isContentItem,
  isOfflineItem,
} from '../dao/derived_types/Lineup.js';
import {
  EnrichedLineupItem,
  StreamLineupItem,
  createOfflineStreamLineupIteam,
  isOfflineLineupItem,
} from '../dao/derived_types/StreamLineup.js';
import { Channel } from '../dao/entities/Channel.js';
import { Program as ProgramEntity } from '../dao/entities/Program.js';
import createLogger from '../logger.js';
import { getServerContext } from '../serverContext.js';
import { FillerPicker } from '../services/FillerPicker.js';
import { STREAM_CHANNEL_CONTEXT_KEYS, StreamContextChannel } from './types.js';
import { Nullable } from '../types/util.js';
import { zipWithIndex } from '../util/index.js';
import { binarySearchRange } from '../util/binarySearch.js';
import { random } from '../util/random.js';

const SLACK = constants.SLACK;

// Figure out this type later...
export type ProgramAndTimeElapsed = {
  program: EnrichedLineupItem;
  timeElapsed: number;
  programIndex: number;
};

const logger = createLogger(import.meta);

// This code is almost identical to TvGuideService#getCurrentPlayingIndex
export async function getCurrentProgramAndTimeElapsed(
  timestamp: number,
  channel: Loaded<Channel>,
  channelLineup: Lineup,
): Promise<ProgramAndTimeElapsed> {
  if (channel.startTime > timestamp) {
    logger.debug(
      'Channel start time is above the given date. Flex time is picked till that.',
    );
    return {
      program: createOfflineStreamLineupIteam(channel.startTime - timestamp),
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
  let program: StreamLineupItem;
  if (isContentItem(lineupItem)) {
    // Defer program lookup
    const backingItem = await getEm().findOne(ProgramEntity, {
      uuid: lineupItem.id,
    });

    program = {
      duration: lineupItem.durationMs,
      type: 'offline',
    };

    if (!isNil(backingItem) && programHasRequiredStreamingFields(backingItem)) {
      // TODO put a logger warning here
      program = {
        type: 'program',
        plexFilePath: backingItem.plexFilePath!,
        externalKey: backingItem.externalKey,
        filePath: backingItem.filePath!,
        externalSourceId: backingItem.externalSourceId,
        duration: backingItem.duration,
        programId: backingItem.uuid,
        title: backingItem.title,
        id: backingItem.uuid,
      };
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

function programHasRequiredStreamingFields(program: Loaded<ProgramEntity>) {
  return every(
    [program.plexFilePath, program.plexRatingKey, program.filePath],
    negate(isNil),
  );
}

// TODO: This only ever returns a single-element array - fix the return type to simplify things
// The naming is also kinda terrible - maybe it changed over time? This function seems to do one of:
// 1. If the current item is an error item, return it with the time remaining until next up
// 2. If the current program is "offline" type, try to pick best fitting content among fillter
// 2b. If no fillter content is found, then pad with more offline time
// 3. Return the currently playing "real" program
export async function createLineupItem(
  obj: ProgramAndTimeElapsed,
  channel: Loaded<Channel>,
  isFirst: boolean,
): Promise<StreamLineupItem> {
  let timeElapsed = obj.timeElapsed;
  // Start time of a file is never consistent unless 0. Run time of an episode can vary.
  // When within 30 seconds of start time, just make the time 0 to smooth things out
  // Helps prevents losing first few seconds of an episode upon lineup change
  const activeProgram = obj.program;
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

  if (isOfflineLineupItem(activeProgram)) {
    //offline case
    let remaining = activeProgram.duration - timeElapsed;
    //look for a random filler to play
    const fillerPrograms =
      await getServerContext().fillerDB.getFillersFromChannel(channel.uuid);

    let filler: Nullable<EntityDTO<ProgramEntity>>;
    let fallbackProgram: Nullable<EntityDTO<ProgramEntity>> = null;

    // See if we have any fallback programs set
    await channel.fallback.init();
    if (channel.offline.mode === 'clip' && channel.fallback?.length != 0) {
      fallbackProgram = wrap(first(channel.fallback)!).toJSON();
    }

    // Pick a random filler, too
    const randomResult = new FillerPicker().pickRandomWithMaxDuration(
      channel,
      fillerPrograms,
      remaining + (isFirst ? 7 * 24 * 60 * 60 * 1000 : 0),
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

        // Otherwise, if we're dealing with the first item in the lineup,
      } else if (isFirst) {
        fillerstart = Math.max(0, filler.duration - remaining);
        //it's boring and odd to tune into a channel and it's always
        //the start of a commercial.
        const more = Math.max(0, filler.duration - fillerstart - 15000 - SLACK);
        fillerstart += random.integer(0, more);
      }

      return {
        // just add the video, starting at 0, playing the entire duration
        type: 'commercial',
        title: filler.title,
        filePath: filler.filePath!,
        externalKey: filler.externalKey,
        start: fillerstart,
        streamDuration: Math.max(
          1,
          Math.min(filler.duration - fillerstart, remaining),
        ),
        duration: filler.duration,
        programId: filler.uuid,
        beginningOffset: beginningOffset,
        externalSourceId: filler.externalSourceId,
        plexFilePath: filler.plexFilePath!,
      };
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

// any channel thing used here should be added to channel context
export function generateChannelContext(
  channel: Loaded<Channel, never, '*'>,
): StreamContextChannel {
  return pick(
    channel,
    STREAM_CHANNEL_CONTEXT_KEYS as ReadonlyArray<keyof Channel>,
  );
}
