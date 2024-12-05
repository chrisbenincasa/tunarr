/* eslint-disable @typescript-eslint/no-unused-vars */
import { ChannelProgram, FlexProgram, isFlexProgram } from '@tunarr/types';
import { RandomSlot, RandomSlotSchedule } from '@tunarr/types/api';
import dayjs from 'dayjs';
import duration, { Duration } from 'dayjs/plugin/duration.js';
import relativeTime from 'dayjs/plugin/relativeTime.js';
import utc from 'dayjs/plugin/utc.js';
import {
  first,
  forEach,
  isNil,
  isNull,
  last,
  map,
  reject,
  sortBy,
} from 'lodash-es';
import { MersenneTwister19937, Random } from 'random-js';
import constants from '../util/constants.js';
import { mod } from '../util/dayjsExtensions.js';
import { advanceIterator, getNextProgramForSlot } from './ProgramIterator.js';
import {
  createProgramIterators,
  createProgramMap,
} from './slotSchedulerUtil.js';

export const random = new Random(MersenneTwister19937.autoSeed());

dayjs.extend(duration);
dayjs.extend(relativeTime);
dayjs.extend(mod);
dayjs.extend(utc);

export type PaddedProgram = {
  program: ChannelProgram;
  padMs: number;
  totalDuration: number;
};

// Adds flex time to the end of a programs array.
// If the final program is flex itself, just extends it
// Mutates the lineup array
// function pushOrExtendFlex(
//   lineup: ChannelProgram[],
//   flexDuration: Duration,
// ): [number, ChannelProgram[]] {
//   const durationMs = flexDuration.asMilliseconds();
//   if (durationMs <= 0) {
//     return [0, lineup];
//   }

//   const lastLineupItem = last(lineup);
//   if (lastLineupItem && isFlexProgram(lastLineupItem)) {
//     const newDuration = lastLineupItem.duration + durationMs;
//     const newItem: FlexProgram = {
//       type: 'flex',
//       duration: newDuration,
//       persisted: false,
//     };
//     lineup[lineup.length - 1] = newItem;
//     return [durationMs, lineup];
//   }

//   const newItem: FlexProgram = {
//     type: 'flex',
//     persisted: false,
//     duration: durationMs,
//   };

//   lineup.push(newItem);
//   return [durationMs, lineup];
// }

function createPaddedProgram(program: ChannelProgram, padMs: number) {
  const rem = program.duration % padMs;
  const padAmount = padMs - rem;
  const shouldPad = rem > constants.SLACK && padAmount > constants.SLACK;
  return {
    program,
    padMs: shouldPad ? padAmount : 0,
    totalDuration: program.duration + (shouldPad ? padAmount : 0),
  };
}

// Exported for testing only
export function distributeFlex(
  programs: PaddedProgram[],
  schedule: RandomSlotSchedule,
  remainingTime: number,
) {
  if (programs.length === 0) {
    return;
  }

  const div = Math.floor(remainingTime / schedule.padMs);
  const mod = remainingTime % schedule.padMs;
  // Add leftover flex to end
  last(programs)!.padMs += mod;
  last(programs)!.totalDuration += mod;

  // Padded programs sorted by least amount of existing padding
  // along with their original index in the programs array
  const sortedPads = sortBy(
    map(programs, ({ padMs }, index) => ({ padMs, index })),
    ({ padMs }) => padMs,
  );

  forEach(programs, (_, i) => {
    let q = Math.floor(div / programs.length);
    if (i < div % programs.length) {
      q++;
    }
    const extraPadding = q * schedule.padMs;
    programs[sortedPads[i].index].padMs += extraPadding;
    programs[sortedPads[i].index].totalDuration += extraPadding;
  });
}

const createFlex = function (flexDuration: Duration) {
  return {
    type: 'flex',
    persisted: false,
    duration: +flexDuration,
  } satisfies FlexProgram;
};

// eslint-disable-next-line @typescript-eslint/require-await
export async function* scheduleRandomSlots(
  schedule: RandomSlotSchedule,
  channelProgramming: ChannelProgram[],
  startTime: dayjs.Dayjs = dayjs.tz(),
): AsyncGenerator<ChannelProgram> {
  // Load programs
  // TODO include custom programs!
  const allPrograms = reject(channelProgramming, (p) => isFlexProgram(p));
  const programBySlotType = createProgramMap(allPrograms);
  const programmingIteratorsById = createProgramIterators(
    schedule.slots,
    programBySlotType,
  );

  const t0 = startTime;
  const upperLimit = t0.add(schedule.maxDays + 1, 'day');

  let timeCursor = t0;

  const advanceTime = (by: number | Duration) => {
    timeCursor = dayjs.isDuration(by) ? timeCursor.add(by) : timeCursor.add(by);
  };

  const slotsLastPlayedMap: Record<number, number> = {};

  while (timeCursor.isBefore(upperLimit)) {
    // await flushEventLoop();
    let currSlot: RandomSlot | null = null;
    let remaining: number = 0;

    // Pad time
    const m = +timeCursor.mod(schedule.padMs);
    if (m > constants.SLACK && schedule.padMs - m > constants.SLACK) {
      const duration = dayjs.duration(schedule.padMs - m);
      yield createFlex(duration);
      advanceTime(duration);
      continue;
    }

    let n = 0; // What is this?
    let minNextTime = timeCursor.add(24, 'days');
    for (let i = 0; i < schedule.slots.length; i++) {
      const slot = schedule.slots[i];
      const slotLastPlayed = slotsLastPlayedMap[i];
      if (!isNil(slotLastPlayed)) {
        const nextPlay = dayjs.tz(slotLastPlayed + slot.cooldownMs);
        minNextTime = minNextTime.isBefore(nextPlay) ? minNextTime : nextPlay;
        if (
          +dayjs.duration(timeCursor.diff(slotLastPlayed)) <
          slot.cooldownMs - constants.SLACK
        ) {
          continue;
        }
      }

      n += slot.weight;

      if (random.bool(slot.weight, n)) {
        currSlot = slot;
        remaining = slot.durationMs;
      }
    }

    if (isNull(currSlot)) {
      const duration = dayjs.duration(+minNextTime.subtract(+timeCursor));
      yield createFlex(duration);
      advanceTime(duration);
      continue;
    }

    let program = getNextProgramForSlot(
      currSlot,
      programmingIteratorsById,
      remaining,
    );

    if (isNull(program) || isFlexProgram(program)) {
      yield createFlex(dayjs.duration(remaining));
      advanceTime(remaining);
      continue;
    }

    // HACK
    if (program.type === 'redirect') {
      program = { ...program, duration: remaining };
    }

    // Program longer than we have left? Add it and move on...
    if (program && program.duration > remaining) {
      yield program;
      advanceIterator(currSlot, programmingIteratorsById);
      advanceTime(program.duration);
      continue;
    }

    const paddedProgram = createPaddedProgram(
      program,
      schedule.padStyle === 'slot' ? 1 : schedule.padMs,
    );
    let totalDuration = paddedProgram.totalDuration;
    advanceIterator(currSlot, programmingIteratorsById);
    const paddedPrograms: PaddedProgram[] = [paddedProgram];

    for (;;) {
      const nextProgram = getNextProgramForSlot(
        currSlot,
        programmingIteratorsById,
        remaining,
      );
      if (isNull(nextProgram)) break;
      if (totalDuration + nextProgram.duration > remaining) {
        break;
      }
      const nextPadded = createPaddedProgram(
        nextProgram,
        schedule.padStyle === 'slot' ? 1 : schedule.padMs,
      );
      paddedPrograms.push(nextPadded);
      advanceIterator(currSlot, programmingIteratorsById);
      totalDuration += nextPadded.totalDuration;
    }

    let remainingTimeInSlot = 0;
    const startOfNextBlock = +timeCursor.add(totalDuration);
    // .mod(schedule.padMs)
    // .asMilliseconds();
    if (
      startOfNextBlock % schedule.padMs >= constants.SLACK &&
      startOfNextBlock % schedule.padMs < schedule.padMs - constants.SLACK
    ) {
      remainingTimeInSlot =
        schedule.padMs - (startOfNextBlock % schedule.padMs);
    }

    // We have two options here if there is remaining time in the slot
    // If we want to be "greedy", we can keep attempting to look for items
    // to fill the time for this slot. This works mainly if we're doing a
    // "shuffle" ordering, it won't work for "in order" shows in slots.
    // TODO: Implement greedy filling.
    // TODO: Handle padStyle === 'episode'
    if (
      schedule.flexPreference === 'distribute' &&
      schedule.padStyle === 'episode'
    ) {
      distributeFlex(paddedPrograms, schedule, remainingTimeInSlot);
    } else if (schedule.flexPreference === 'distribute') {
      const div = Math.floor(remaining / paddedPrograms.length);
      let totalAdded = 0;
      forEach(paddedPrograms, (paddedProgram) => {
        paddedProgram.padMs += div;
        totalAdded += div;
      });
      first(paddedPrograms)!.padMs += remaining - totalAdded;
    } else {
      const lastProgram = last(paddedPrograms)!;
      lastProgram.padMs += remainingTimeInSlot;
      lastProgram.totalDuration += remainingTimeInSlot;
    }

    let done = false;
    for (const { program, padMs } of paddedPrograms) {
      if (+timeCursor + program.duration > +upperLimit) {
        done = true;
        break;
      }
      yield program;
      advanceTime(program.duration);
      if (+timeCursor + padMs > +upperLimit) {
        done = true;
        break;
      }
      yield createFlex(dayjs.duration(padMs));
      advanceTime(padMs);
    }

    if (done) {
      break;
    }
    // forEach(paddedPrograms, ({ program, padMs }) => {
    //   channelPrograms.push(program);
    //   timeCursor = timeCursor.add(program.duration);
    //   yield* pushFlex(dayjs.duration(padMs));
    // });
  }

  // return {
  //   programs: channelPrograms,
  //   startTime: +t0,
  // };
}
