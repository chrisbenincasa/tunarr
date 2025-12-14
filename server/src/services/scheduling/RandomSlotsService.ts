import dayjs from '@/util/dayjs.js';
import { dayjsMod } from '@tunarr/shared';
import constants from '@tunarr/shared/constants';
import type { CondensedChannelProgram } from '@tunarr/types';
import { isFlexProgram, isRedirectProgram } from '@tunarr/types';
import type { RandomSlotSchedule, SlotScheduleResult } from '@tunarr/types/api';
import type { Duration } from 'dayjs/plugin/duration.js';
import duration from 'dayjs/plugin/duration.js';
import relativeTime from 'dayjs/plugin/relativeTime.js';
import utc from 'dayjs/plugin/utc.js';
import {
  find,
  forEach,
  isNil,
  isNull,
  isNumber,
  isUndefined,
  last,
  map,
  orderBy,
  sum,
} from 'lodash-es';
import { createEntropy, MersenneTwister19937, Random } from 'random-js';
import type { NonEmptyArray } from 'ts-essentials';
import type { Nilable } from '../../types/util.ts';
import { isNonEmptyArray, zipWithIndex } from '../../util/index.ts';
import {
  slotIteratorKey,
  type IterationState,
  type ProgramIterator,
} from './ProgramIterator.ts';
import { RandomSlotImpl } from './RandomSlotImpl.ts';
import type {
  PaddedProgram,
  SlotSchedulerProgram,
} from './slotSchedulerUtil.js';
import {
  addHeadAndTailFillerToSlot,
  createPaddedProgram,
  createProgramIterators,
  createProgramMap,
  deduplicatePrograms,
  distributeFlex,
  maybeAddPrePostFiller,
  pushOrExtendFlex,
  slotFillerIterators,
} from './slotSchedulerUtil.js';

export const random = new Random(MersenneTwister19937.autoSeed());

dayjs.extend(duration);
dayjs.extend(relativeTime);
dayjs.extend(utc);
dayjs.extend(dayjsMod);

class ScheduleContext {
  #startTime: dayjs.Dayjs;
  #timeCursor: dayjs.Dayjs;
  #programmingIteratorsById: Record<string, ProgramIterator>;
  #workingLineup: CondensedChannelProgram[] = [];
  #sortedSlots: RandomSlotImpl[];
  #slotLastPlayed: Map<number, number> = new Map<number, number>();
  #currentSlotIndex = 0;
  #seed: number[];
  #random: Random;
  #engine: MersenneTwister19937;

  constructor(
    schedule: RandomSlotSchedule,
    programming: SlotSchedulerProgram[],
    startTime: dayjs.Dayjs,
    seed: number[] = createEntropy(),
    discardCount: number = 0,
  ) {
    this.#seed = seed;
    this.#engine = MersenneTwister19937.seedWithArray(this.#seed).discard(
      discardCount,
    );
    this.#random = new Random(this.#engine);
    this.#programmingIteratorsById = createProgramIterators(
      schedule.slots,
      createProgramMap(deduplicatePrograms(programming)),
      this.#random,
    );
    this.#startTime = this.#timeCursor = startTime;
    this.#sortedSlots = map(
      orderBy(schedule.slots, (slot, idx) => slot.index ?? idx, 'asc'),
      (slot) =>
        new RandomSlotImpl(
          slot,
          this.#programmingIteratorsById[slotIteratorKey(slot)]!,
          this.#random,
          slotFillerIterators(slot, this.programmingIteratorsById),
        ),
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

  advanceIterator(slot: RandomSlotImpl) {
    slot.advanceIterator();
  }

  get timeCursor() {
    return this.#timeCursor;
  }

  get programmingIteratorsById() {
    return this.#programmingIteratorsById;
  }

  getNextProgramForSlot(
    slot: RandomSlotImpl,
    state: IterationState = {
      slotDuration:
        slot.durationSpec.type === 'fixed' ? slot.durationSpec.durationMs : -1,
      timeCursor: +this.timeCursor,
    },
  ) {
    return slot.getNextProgram(state);
  }

  pushOrExtendFlex(dur: number | Duration) {
    pushOrExtendFlex(
      this.#workingLineup,
      isNumber(dur) ? dayjs.duration(dur) : dur,
    );
    this.advanceTime(dur);
  }

  pushProgram(program: Nilable<CondensedChannelProgram>) {
    if (!program) {
      return;
    }

    this.#workingLineup.push(program);
  }

  get lineup(): CondensedChannelProgram[] {
    return this.#workingLineup;
  }

  // Indexed into the sorted slots array
  getSlotLastPlayedTime(slotIndex: number) {
    return this.#slotLastPlayed.get(slotIndex);
  }

  getNextSequentialSlot() {
    const slot = this.#sortedSlots[this.#currentSlotIndex]!;
    this.#currentSlotIndex =
      (this.#currentSlotIndex + 1) % this.#sortedSlots.length;
    return slot;
  }

  get result(): SlotScheduleResult {
    return {
      lineup: this.lineup,
      seed: this.#seed,
      startTime: +this.#startTime,
      discardCount: this.#engine.getUseCount(),
    };
  }
}

export class RandomSlotScheduler {
  constructor(private schedule: RandomSlotSchedule) {}

  generateSchedule(
    programming: SlotSchedulerProgram[],
    seed: number[] = createEntropy(),
    discardCount: number = 0,
    startTime: dayjs.Dayjs = dayjs.tz(),
  ): SlotScheduleResult {
    this.validateSchedule();

    const context = new ScheduleContext(
      this.schedule,
      programming,
      startTime,
      seed,
      discardCount,
    );

    const { maxDays, padMs, padStyle, flexPreference, randomDistribution } =
      this.schedule;

    const t0 = startTime;
    const upperLimit = t0.add(maxDays + 1, 'day');

    while (context.timeCursor.isBefore(upperLimit)) {
      let currSlot: RandomSlotImpl | null = null;

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

      if (isNull(currSlot)) {
        const duration = dayjs.duration(
          +minNextTime.subtract(+context.timeCursor),
        );
        context.pushOrExtendFlex(duration);
        continue;
      }

      if (isUndefined(currSlot.durationSpec) && !isNil(currSlot.durationMs)) {
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
        distributeFlex(
          paddedPrograms,
          this.schedule.padMs,
          remainingTimeInSlot,
        );
      } else if (flexPreference === 'distribute') {
        // We pad the slot as a whole here. We must find the first content-type
        // program to add the padding to.
        const div = Math.floor(remainingTimeInSlot / paddedPrograms.length);
        let totalAdded = 0;
        forEach(paddedPrograms, (paddedProgram) => {
          if (paddedProgram.program.type === 'filler') {
            return;
          }
          paddedProgram.padMs += div;
          totalAdded += div;
        });
        const firstContent = find(
          paddedPrograms,
          ({ program }) => program.type !== 'filler',
        );
        if (firstContent) {
          firstContent.padMs += remainingTimeInSlot - totalAdded;
        }
      } else {
        const lastProgram = last(paddedPrograms)!;
        lastProgram.padMs += remainingTimeInSlot;
      }

      let done = false;
      for (const { program, padMs, totalDuration, filler } of paddedPrograms) {
        if (+context.timeCursor + program.duration > +upperLimit) {
          done = true;
          break;
        }

        context.pushProgram(filler.head);
        context.pushProgram(filler.pre);
        context.pushProgram(program);
        context.pushProgram(filler.post);
        context.pushProgram(filler.tail);
        context.advanceTime(totalDuration - padMs);

        if (+context.timeCursor + padMs > +upperLimit) {
          done = true;
          break;
        }

        if (padMs > constants.SLACK) {
          const fallback = currSlot.getFillerOfType('fallback', {
            slotDuration: -1,
            timeCursor: +context.timeCursor,
          });
          // TODO: This kinda isn't right... for programs shorter than padMs, we need to make sure we loop this
          // for programs longer than padMs, we need to make sure we cut at duration.
          if (fallback) {
            context.pushProgram({
              ...fallback,
              duration: padMs,
            });
          } else {
            context.pushOrExtendFlex(padMs);
          }
        }
      }

      if (done) {
        break;
      }
    }

    return context.result;
  }

  private validateSchedule() {
    for (const slot of this.schedule.slots) {
      if (isUndefined(slot.durationSpec)) {
        throw new Error(
          `Slot definition missing duration spec: ${JSON.stringify(slot)}`,
        );
      }

      if (slot.durationSpec.type === 'dynamic') {
        switch (slot.type) {
          case 'flex':
          case 'redirect':
            throw new Error(
              `Cannot schedule slot of type ${slot.type} with dynamic duration`,
            );
          case 'movie':
          case 'show':
          case 'custom-show':
          case 'filler':
          case 'smart-collection':
            break;
        }
      }
    }
  }

  private handleFixedDurationSlot(
    currSlot: RandomSlotImpl,
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

    maybeAddPrePostFiller(
      currSlot,
      paddedProgram,
      slotDuration - paddedProgram.totalDuration,
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
      maybeAddPrePostFiller(
        currSlot,
        nextPadded,
        slotDuration - nextPadded.totalDuration,
      );
      totalDuration += nextPadded.totalDuration;
    }

    if (!currSlot.hasAnyFillerSettings()) {
      return paddedPrograms;
    }

    // There are a couple approaches to interleaving filler content within
    // a slot with a fixed duration. The approach we'll take here first attempts
    // to fill the slot with as much content as possible, since that's why we're
    // here in the first place. From there, we fan out by filler "importance"...
    // Right now, this means we prioritize pre/post filler, then head/tail.
    // Fallback filler gets added outside of this method after we've packed the
    // slot as much as possible.
    const remainingTime = currSlot.durationMs! - totalDuration;
    addHeadAndTailFillerToSlot(remainingTime, currSlot, paddedPrograms);
    return paddedPrograms;
  }

  private handleDynamicDurationSlot(
    currSlot: RandomSlotImpl,
    context: ScheduleContext,
  ): NonEmptyArray<PaddedProgram> | undefined {
    if (currSlot.durationSpec.type !== 'dynamic') {
      throw new Error('Illegal state');
    } else if (currSlot.durationSpec.programCount <= 0) {
      throw new Error('Cannot schedule a non-position program count');
    }

    const paddedPrograms: PaddedProgram[] = [];

    let idx = 0;
    do {
      const program = context.getNextProgramForSlot(currSlot);

      if (program) {
        const paddedProgram = this.createPaddedProgram(program);
        paddedPrograms.push(paddedProgram);

        const preFiller = currSlot.getFillerOfType('pre', {
          slotDuration: -1,
          timeCursor: +context.timeCursor,
        });

        if (preFiller) {
          paddedProgram.filler.pre = preFiller;
        }

        const postFilter = currSlot.getFillerOfType('post', {
          slotDuration: -1,
          timeCursor: +context.timeCursor,
        });

        if (postFilter) {
          paddedProgram.filler.post = postFilter;
        }

        currSlot.advanceIterator();
      }

      idx++;
    } while (idx < currSlot.durationSpec.programCount);

    if (isNonEmptyArray(paddedPrograms)) {
      const headFiller = currSlot.getFillerOfType('head', {
        slotDuration: -1,
        timeCursor: +context.timeCursor,
      });

      if (headFiller) {
        paddedPrograms[0].filler.head = headFiller;
      }

      const tailFilter = currSlot.getFillerOfType('tail', {
        slotDuration: -1,
        timeCursor: +context.timeCursor,
      });

      if (tailFilter) {
        paddedPrograms[paddedPrograms.length - 1]!.filler.tail = tailFilter;
      }

      return paddedPrograms;
    }

    return;
  }

  private createPaddedProgram(program: CondensedChannelProgram) {
    return createPaddedProgram(
      program,
      this.schedule.padStyle === 'slot' ? 1 : this.schedule.padMs,
    );
  }

  private getRandomSlot(context: ScheduleContext) {
    let n = 0;
    let currSlot: RandomSlotImpl | null = null;
    let minNextTime = context.timeCursor.add(24, 'days');
    for (const [slot, i] of zipWithIndex(context.sortedSlots)) {
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
