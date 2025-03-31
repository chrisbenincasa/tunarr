import type { ChannelProgram, FlexProgram } from '@tunarr/types';
import { isFlexProgram, isRedirectProgram } from '@tunarr/types';
import type { RandomSlot, RandomSlotSchedule } from '@tunarr/types/api';
import dayjs from 'dayjs';
import type { Duration } from 'dayjs/plugin/duration.js';
import duration from 'dayjs/plugin/duration.js';
import relativeTime from 'dayjs/plugin/relativeTime.js';
import utc from 'dayjs/plugin/utc.js';
import {
  first,
  forEach,
  isNil,
  isNull,
  isNumber,
  isUndefined,
  last,
  map,
  orderBy,
  reject,
  sortBy,
  sum,
} from 'lodash-es';
import { MersenneTwister19937, Random } from 'random-js';
import type { NonEmptyArray } from 'ts-essentials';
import type { ProgramIterator } from '../util/ProgramIterator.js';
import {
  advanceIterator,
  getNextProgramForSlot,
} from '../util/ProgramIterator.js';
import constants from '../util/constants.js';
import { mod } from '../util/dayjsExtensions.js';
import {
  createProgramIterators,
  createProgramMap,
} from '../util/slotSchedulerUtil.js';

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
function pushOrExtendFlex(
  lineup: ChannelProgram[],
  flexDuration: Duration,
): [number, ChannelProgram[]] {
  const durationMs = flexDuration.asMilliseconds();
  if (durationMs <= 0) {
    return [0, lineup];
  }

  const lastLineupItem = last(lineup);
  if (lastLineupItem && isFlexProgram(lastLineupItem)) {
    const newDuration = lastLineupItem.duration + durationMs;
    const newItem: FlexProgram = {
      type: 'flex',
      duration: newDuration,
      persisted: false,
    };
    lineup[lineup.length - 1] = newItem;
    return [durationMs, lineup];
  }

  const newItem: FlexProgram = {
    type: 'flex',
    persisted: false,
    duration: durationMs,
  };

  lineup.push(newItem);
  return [durationMs, lineup];
}

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

class ScheduleContext {
  #timeCursor: dayjs.Dayjs;
  #programmingIteratorsById: Record<string, ProgramIterator>;
  #workingLineup: ChannelProgram[] = [];
  #sortedSlots: RandomSlot[];
  #slotLastPlayed: Map<number, number> = new Map<number, number>();
  #currentSlotIndex = 0;

  constructor(
    schedule: RandomSlotSchedule,
    programming: ChannelProgram[],
    startTime: dayjs.Dayjs,
  ) {
    this.#programmingIteratorsById = createProgramIterators(
      schedule.slots,
      createProgramMap(reject(programming, (p) => isFlexProgram(p))),
    );
    this.#timeCursor = startTime;
    this.#sortedSlots = orderBy(
      schedule.slots,
      (slot, idx) => slot.index ?? idx,
      'asc',
    );
  }

  get sortedSlots() {
    return this.#sortedSlots;
  }

  advanceTime(by: number | Duration) {
    this.#timeCursor = dayjs.isDuration(by)
      ? this.#timeCursor.add(by)
      : this.#timeCursor.add(by);
  }

  advanceIterator(slot: RandomSlot) {
    advanceIterator(slot, this.#programmingIteratorsById);
  }

  get timeCursor() {
    return this.#timeCursor;
  }

  get programmingIteratorsById() {
    return this.#programmingIteratorsById;
  }

  getNextProgramForSlot(slot: RandomSlot) {
    return getNextProgramForSlot(
      slot,
      this.#programmingIteratorsById,
      slot.durationSpec.type === 'fixed' ? slot.durationSpec.durationMs : -1,
    );
  }

  pushOrExtendFlex(dur: number | Duration) {
    pushOrExtendFlex(
      this.#workingLineup,
      isNumber(dur) ? dayjs.duration(dur) : dur,
    );
    this.advanceTime(dur);
  }

  pushProgram(program: ChannelProgram) {
    this.#workingLineup.push(program);
  }

  get lineup(): ChannelProgram[] {
    return this.#workingLineup;
  }

  // Indexed into the sorted slots array
  getSlotLastPlayedTime(slotIndex: number) {
    return this.#slotLastPlayed.get(slotIndex);
  }

  getNextSequentialSlot() {
    const slot = this.#sortedSlots[this.#currentSlotIndex];
    this.#currentSlotIndex =
      (this.#currentSlotIndex + 1) % this.#sortedSlots.length;
    return slot;
  }
}

export class RandomSlotScheduler {
  constructor(private schedule: RandomSlotSchedule) {}

  generateSchedule(
    programming: ChannelProgram[],
    startTime: dayjs.Dayjs = dayjs.tz(),
  ): ChannelProgram[] {
    this.validateSchedule();

    const context = new ScheduleContext(this.schedule, programming, startTime);

    const { maxDays, padMs, padStyle, flexPreference, randomDistribution } =
      this.schedule;

    const t0 = startTime;
    const upperLimit = t0.add(maxDays + 1, 'day');

    while (context.timeCursor.isBefore(upperLimit)) {
      let currSlot: RandomSlot | null = null;

      let minNextTime = context.timeCursor.add(24, 'days');
      // Pad time
      const m = +context.timeCursor.mod(padMs);
      if (m > constants.SLACK && padMs - m > constants.SLACK) {
        context.pushOrExtendFlex(padMs - m);
        continue;
      }

      switch (randomDistribution) {
        case 'uniform':
        case 'weighted': {
          const result = this.getRandomSlot(context);
          currSlot = result.currSlot;
          minNextTime = result.minNextTime;
          break;
        }
        case 'none':
          currSlot = context.getNextSequentialSlot();
          break;
      }

      // let n = 0;
      // for (let i = 0; i < sortedSlots.length; i++) {
      //   const slot = sortedSlots[i];
      //   // No cooldowns or random picking if we don't want a random
      //   // distribution
      //   if (randomDistribution === 'none') {
      //     currSlot = slot;
      //     break;
      //   }

      //   const slotLastPlayed = slotsLastPlayedMap[i];
      //   if (!isNil(slotLastPlayed)) {
      //     const nextPlay = dayjs.tz(slotLastPlayed + slot.cooldownMs);
      //     minNextTime = minNextTime.isBefore(nextPlay) ? minNextTime : nextPlay;
      //     if (
      //       +dayjs.duration(context.timeCursor.diff(slotLastPlayed)) <
      //       slot.cooldownMs - constants.SLACK
      //     ) {
      //       continue;
      //     }
      //   }

      //   n += slot.weight;

      //   if (random.bool(slot.weight, n)) {
      //     currSlot = slot;
      //   }
      // }

      if (isNull(currSlot)) {
        const duration = dayjs.duration(
          +minNextTime.subtract(+context.timeCursor),
        );
        context.pushOrExtendFlex(duration);
        continue;
      }

      if (
        isUndefined(currSlot.durationSpec) &&
        !isUndefined(currSlot.durationMs)
      ) {
        currSlot.durationSpec = {
          type: 'fixed',
          durationMs: currSlot.durationMs,
        };
      } else if (isUndefined(currSlot.durationSpec)) {
        throw new Error('Invalid slot configuration - missing durationSpec');
      }

      let paddedPrograms: NonEmptyArray<PaddedProgram>;
      if (currSlot.durationSpec.type === 'fixed') {
        const maybePrograms = this.handleFixedDurationSlot(currSlot, context);
        if (!maybePrograms) {
          continue;
        }

        paddedPrograms = maybePrograms;
      } else {
        const maybePrograms = this.handleDynamicDurationSlot(currSlot, context);
        if (!maybePrograms) {
          continue;
        }
        paddedPrograms = maybePrograms;
      }

      const totalDuration = sum(map(paddedPrograms, (p) => p.totalDuration));
      let remainingTimeInSlot = 0;
      const startOfNextBlock = +context.timeCursor.add(totalDuration);
      if (
        startOfNextBlock % padMs >= constants.SLACK &&
        startOfNextBlock % padMs < padMs - constants.SLACK
      ) {
        remainingTimeInSlot = padMs - (startOfNextBlock % padMs);
      }

      // We have two options here if there is remaining time in the slot
      // If we want to be "greedy", we can keep attempting to look for items
      // to fill the time for this slot. This works mainly if we're doing a
      // "shuffle" ordering, it won't work for "in order" shows in slots.
      // TODO: Implement greedy filling.
      if (flexPreference === 'distribute' && padStyle === 'episode') {
        distributeFlex(paddedPrograms, this.schedule, remainingTimeInSlot);
      } else if (flexPreference === 'distribute') {
        const div = Math.floor(remainingTimeInSlot / paddedPrograms.length);
        let totalAdded = 0;
        forEach(paddedPrograms, (paddedProgram) => {
          paddedProgram.padMs += div;
          totalAdded += div;
        });
        first(paddedPrograms).padMs += remainingTimeInSlot - totalAdded;
      } else {
        const lastProgram = last(paddedPrograms)!;
        lastProgram.padMs += remainingTimeInSlot;
        lastProgram.totalDuration += remainingTimeInSlot;
      }

      let done = false;
      for (const { program, padMs } of paddedPrograms) {
        if (+context.timeCursor + program.duration > +upperLimit) {
          done = true;
          break;
        }
        context.pushProgram(program);
        context.advanceTime(program.duration);
        if (+context.timeCursor + padMs > +upperLimit) {
          done = true;
          break;
        }
        if (padMs > constants.SLACK) {
          context.pushOrExtendFlex(padMs);
        }
      }

      if (done) {
        break;
      }
    }

    return context.lineup;
  }

  private validateSchedule() {
    for (const slot of this.schedule.slots) {
      if (isUndefined(slot.durationSpec)) {
        throw new Error(
          `Slot definition missing duration spec: ${JSON.stringify(slot)}`,
        );
      }

      if (slot.durationSpec.type === 'dynamic') {
        switch (slot.programming.type) {
          case 'flex':
          case 'redirect':
            throw new Error(
              `Cannot schedule slot of type ${slot.programming.type} with dynamic duration`,
            );
          case 'movie':
          case 'show':
          case 'custom-show':
            break;
        }
      }
    }
  }

  private handleFixedDurationSlot(
    currSlot: RandomSlot,
    context: ScheduleContext,
  ) {
    if (currSlot.durationSpec.type !== 'fixed') {
      throw new Error(
        'Invalid slot durationSpec type = ' + currSlot.durationSpec.type,
      );
    }

    const { padStyle, padMs } = this.schedule;

    const slotDuration = currSlot.durationSpec.durationMs;

    let program = context.getNextProgramForSlot(currSlot);

    if (isNull(program) || isFlexProgram(program)) {
      context.pushOrExtendFlex(slotDuration);
      return;
    }

    // HACK
    if (isRedirectProgram(program)) {
      program = { ...program, duration: slotDuration };
    }

    // Program longer than we have left? Add it and move on...
    if (program && program.duration > slotDuration) {
      context.pushProgram(program);
      context.advanceIterator(currSlot);
      context.advanceTime(program.duration);
      return;
    }

    const paddedProgram = createPaddedProgram(
      program,
      padStyle === 'slot' ? 1 : padMs,
    );

    let totalDuration = paddedProgram.totalDuration;
    context.advanceIterator(currSlot);
    const paddedPrograms: NonEmptyArray<PaddedProgram> = [paddedProgram];

    for (;;) {
      const nextProgram = context.getNextProgramForSlot(currSlot);
      if (isNull(nextProgram)) break;
      if (totalDuration + nextProgram.duration > slotDuration) {
        break;
      }
      const nextPadded = this.createPaddedProgram(nextProgram);
      paddedPrograms.push(nextPadded);
      context.advanceIterator(currSlot);
      totalDuration += nextPadded.totalDuration;
    }

    return paddedPrograms;
  }

  private handleDynamicDurationSlot(
    currSlot: RandomSlot,
    context: ScheduleContext,
  ): NonEmptyArray<PaddedProgram> | undefined {
    if (currSlot.durationSpec.type !== 'dynamic') {
      throw new Error('Illegal state');
    } else if (currSlot.durationSpec.programCount <= 0) {
      throw new Error('Cannot schedule a non-position program count');
    }

    const initialProgram = context.getNextProgramForSlot(currSlot);
    if (!initialProgram) {
      return;
    }

    const paddedPrograms: NonEmptyArray<PaddedProgram> = [
      this.createPaddedProgram(initialProgram),
    ];
    context.advanceIterator(currSlot);

    let idx = 1;
    while (idx < currSlot.durationSpec.programCount) {
      const program = context.getNextProgramForSlot(currSlot);
      if (program) {
        paddedPrograms.push(this.createPaddedProgram(program));
        context.advanceIterator(currSlot);
      }
      idx++;
    }

    return paddedPrograms;
  }

  private createPaddedProgram(program: ChannelProgram) {
    return createPaddedProgram(
      program,
      this.schedule.padStyle === 'slot' ? 1 : this.schedule.padMs,
    );
  }

  private getRandomSlot(context: ScheduleContext) {
    let n = 0;
    let currSlot: RandomSlot | null = null;
    let minNextTime = context.timeCursor.add(24, 'days');
    for (let i = 0; i < context.sortedSlots.length; i++) {
      const slot = context.sortedSlots[i];
      // No cooldowns or random picking if we don't want a random
      // distribution
      // if (randomDistribution === 'none') {
      //   currSlot = slot;
      //   break;
      // }

      const slotLastPlayed = context.getSlotLastPlayedTime(i);
      // Default next time to play a program
      if (!isNil(slotLastPlayed)) {
        const nextPlay = dayjs.tz(slotLastPlayed + slot.cooldownMs);
        minNextTime = minNextTime.isBefore(nextPlay) ? minNextTime : nextPlay;
        if (
          +dayjs.duration(context.timeCursor.diff(slotLastPlayed)) <
          slot.cooldownMs - constants.SLACK
        ) {
          continue;
        }
      }

      n += slot.weight;

      if (random.bool(slot.weight, n)) {
        currSlot = slot;
      }
    }

    return {
      currSlot,
      minNextTime,
    };
  }
}
