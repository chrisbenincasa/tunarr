import dayjs from '@/util/dayjs.js';
import constants from '@tunarr/shared/constants';
import type {
  ChannelProgram,
  CondensedChannelProgram,
  ContentProgram,
  FillerProgram,
  FlexProgram,
} from '@tunarr/types';
import {
  isContentProgram,
  isCustomProgram,
  isFillerProgram,
  isFlexProgram,
} from '@tunarr/types';
import type {
  SlotFillerTypes,
  TimeSlotSchedule,
  TimeSlotScheduleResult,
} from '@tunarr/types/api';
import duration from 'dayjs/plugin/duration.js';
import relativeTime from 'dayjs/plugin/relativeTime.js';
import tz from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';
import {
  first,
  forEach,
  isNull,
  last,
  map,
  nth,
  reject,
  sortBy,
  sumBy,
} from 'lodash-es';
import { createEntropy, MersenneTwister19937, Random } from 'random-js';
import type { NonEmptyArray } from 'ts-essentials';
import type { Nilable } from '../../types/util.ts';
import { slotIteratorKey } from './ProgramIterator.ts';
import {
  addHeadAndTailFillerToSlot,
  condense,
  createPaddedProgram,
  createProgramIterators,
  createProgramMap,
  deduplicatePrograms,
  distributeFlex,
  maybeAddPrePostFiller,
  slotFillerIterators,
} from './slotSchedulerUtil.js';
import { TimeSlotImpl } from './TimeSlotImpl.js';

dayjs.extend(duration);
dayjs.extend(relativeTime);
// dayjs.extend(mod);
dayjs.extend(utc);
dayjs.extend(tz);

type PaddedProgram = {
  program: ChannelProgram;
  padMs: number;
  totalDuration: number;
  filler: Partial<Record<SlotFillerTypes, ChannelProgram>>;
};

// Adds flex time to the end of a programs array.
// If the final program is flex itself, just extends it
// Returns amount to increment the cursor
// Mutates the lineup array
function pushOrExtendFlex(
  lineup: CondensedChannelProgram[],
  flexDurationMs: number,
): number {
  if (flexDurationMs <= 0) {
    return 0;
  }

  const lastLineupItem = last(lineup);
  if (lastLineupItem && isFlexProgram(lastLineupItem)) {
    const newDuration = lastLineupItem.duration + flexDurationMs;
    const newItem: FlexProgram = {
      type: 'flex',
      duration: newDuration,
      persisted: false,
    };
    lineup[lineup.length - 1] = newItem;
    return flexDurationMs;
  }

  const newItem: FlexProgram = {
    type: 'flex',
    persisted: false,
    duration: flexDurationMs,
  };

  lineup.push(newItem);
  return flexDurationMs;
}

// eslint-disable-next-line @typescript-eslint/require-await
export async function scheduleTimeSlots(
  schedule: TimeSlotSchedule,
  channelProgramming: ChannelProgram[],
): Promise<TimeSlotScheduleResult> {
  const seed = createEntropy();
  const random = new Random(MersenneTwister19937.seedWithArray(seed));
  const contentProgramsById: Record<string, ContentProgram> = {};
  const condensedProgramsById: Record<string, CondensedChannelProgram> = {};
  for (const program of channelProgramming) {
    if (isContentProgram(program)) {
      contentProgramsById[program.uniqueId] = program;
      condensedProgramsById[program.uniqueId] = condense(program);
    } else if (
      (isCustomProgram(program) && program.program?.id) ||
      (isFillerProgram(program) && program.program?.id)
    ) {
      contentProgramsById[program.program.id] = program.program;
      condensedProgramsById[program.program.id] = condense(program.program);
    }
  }

  // Load programs
  // TODO: include redirects and custom programs!
  const allPrograms = deduplicatePrograms(
    reject<ChannelProgram>(channelProgramming, isFlexProgram),
  );
  const contentProgramIteratorsById = createProgramIterators(
    schedule.slots,
    createProgramMap(allPrograms),
    random,
  );

  const periodDuration = dayjs.duration(1, schedule.period);
  const periodMs = dayjs.duration(1, schedule.period).asMilliseconds();
  // TODO: validate

  const sortedSlots = map(
    sortBy(schedule.slots, (slot) => slot.startTime),
    (slot) =>
      new TimeSlotImpl(
        {
          ...slot,
          startTime: slot.startTime,
        },
        contentProgramIteratorsById[slotIteratorKey(slot)],
        random,
        slotFillerIterators(slot, contentProgramIteratorsById),
      ),
  );

  const now = dayjs.tz();
  const startOfCurrentPeriod = now.startOf(schedule.period);
  let t0 = startOfCurrentPeriod.add(
    first(sortedSlots)!.startTime,
    'millisecond',
  );

  if (schedule.startTomorrow) {
    t0 = t0.add(1, 'day');
  }

  const upperLimit = t0.add(schedule.maxDays + 1, 'day');

  let timeCursor = t0;
  const channelPrograms: CondensedChannelProgram[] = [];

  const maybeCondenseProgram = (program: ChannelProgram) => {
    return program.type === 'content'
      ? (condensedProgramsById[program.uniqueId] ?? condense(program))
      : program;
  };

  const pushFlex = (flexDurationMs: number) => {
    const inc = pushOrExtendFlex(channelPrograms, flexDurationMs);
    timeCursor = timeCursor.add(inc);
  };

  const pushProgram = (program: Nilable<ChannelProgram>) => {
    if (!program) {
      return;
    }

    channelPrograms.push(maybeCondenseProgram(program));
    timeCursor = timeCursor.add(program.duration);
  };

  while (timeCursor.isBefore(upperLimit)) {
    let currOffset = timeCursor.diff(startOfCurrentPeriod) % periodMs;

    let currSlot: TimeSlotImpl | null = null;
    let lateMillis: number | null = null;
    let slotDuration = 0;

    const m = +timeCursor.mod(schedule.padMs);
    if (m > constants.SLACK && schedule.padMs - m > constants.SLACK) {
      pushFlex(schedule.padMs - m);
      continue;
    }

    for (let i = 0; i < sortedSlots.length; i++) {
      const slot = sortedSlots[i];
      let endTime: number;
      if (i === sortedSlots.length - 1) {
        endTime = first(sortedSlots)!.startTime + periodMs;
      } else {
        endTime = nth(sortedSlots, i + 1)!.startTime;
      }

      if (slot.startTime <= currOffset && currOffset < endTime) {
        currSlot = slot;
        slotDuration = endTime - currOffset;
        lateMillis = currOffset - slot.startTime;
        break;
      }

      const nextPeriodOffset = dayjs
        .duration(currOffset)
        .add(periodDuration)
        .asMilliseconds();
      if (slot.startTime <= nextPeriodOffset && nextPeriodOffset < endTime) {
        currSlot = slot;
        currOffset = nextPeriodOffset;
        slotDuration = endTime - currOffset;
        lateMillis =
          currOffset + periodDuration.asMilliseconds() - slot.startTime;
        break;
      }
    }

    if (isNull(currSlot)) {
      throw new Error('Could not find a suitable slot');
    }

    let program = currSlot.getNextProgram({
      timeCursor: +timeCursor,
      slotDuration: slotDuration,
    });

    if (
      !isNull(lateMillis) &&
      lateMillis >= schedule.latenessMs + constants.SLACK
    ) {
      pushFlex(slotDuration);
      continue;
    }

    if (isNull(program) || isFlexProgram(program)) {
      pushFlex(slotDuration);
      continue;
    }

    if (program.type === 'redirect') {
      program = { ...program, duration: slotDuration };
    }

    // Program longer than we have left? Add it and move on...
    if (program.duration > slotDuration) {
      const condensed =
        program.type === 'content'
          ? (condensedProgramsById[program.uniqueId] ?? condense(program))
          : program;
      channelPrograms.push(condensed);
      currSlot.advanceIterator();
      timeCursor = timeCursor.add(program.duration);
      continue;
    }

    const paddedProgram = createPaddedProgram(program, schedule.padMs);
    currSlot.advanceIterator();
    const paddedPrograms: NonEmptyArray<PaddedProgram> = [paddedProgram];
    maybeAddPrePostFiller(
      currSlot,
      paddedProgram,
      slotDuration - paddedProgram.totalDuration,
    );
    let totalAddedDuration = paddedProgram.totalDuration;

    for (;;) {
      const nextProgram = currSlot.getNextProgram({
        timeCursor: +timeCursor + totalAddedDuration,
        slotDuration: slotDuration,
      });
      if (isNull(nextProgram)) break;
      if (totalAddedDuration + nextProgram.duration > slotDuration) {
        break;
      }
      const nextPadded = createPaddedProgram(nextProgram, schedule.padMs);
      paddedPrograms.push(nextPadded);
      currSlot.advanceIterator();
      maybeAddPrePostFiller(
        currSlot,
        nextPadded,
        slotDuration - nextPadded.totalDuration,
      );
      totalAddedDuration += nextPadded.totalDuration;
    }

    let remainingTimeInSlot = Math.max(0, slotDuration - totalAddedDuration);
    if (currSlot.hasAnyFillerSettings()) {
      remainingTimeInSlot = addHeadAndTailFillerToSlot(
        remainingTimeInSlot,
        currSlot,
        paddedPrograms,
      );
    }

    // We have two options here if there is remaining time in the slot
    // If we want to be "greedy", we can keep attempting to look for items
    // to fill the time for this slot. This works mainly if we're doing a
    // "shuffle" ordering, it won't work for "in order" shows in slots.
    // TODO: Implement greedy filling.
    if (
      schedule.flexPreference === 'distribute' &&
      currSlot.type !== 'filler'
    ) {
      distributeFlex(
        paddedPrograms,
        schedule.padMs,
        Math.max(
          0,
          slotDuration - sumBy(paddedPrograms, (p) => p.totalDuration),
        ),
      );
    } else {
      const lastProgram = last(paddedPrograms)!;
      lastProgram.padMs += remainingTimeInSlot;
    }

    forEach(paddedPrograms, ({ program, padMs, filler }) => {
      pushProgram(filler.head);
      pushProgram(filler.pre);
      pushProgram(program);
      pushProgram(filler.post);
      pushProgram(filler.tail);

      // Special handling for fallback.
      if (padMs > 0) {
        let filler = currSlot.getFillerOfType('fallback', {
          slotDuration: -Infinity, // Pick anything
          timeCursor: -1,
        });

        if (filler) {
          // Expand / reduce fallback filler to the necessary duration
          filler = {
            ...filler,
            duration: padMs,
            fillerType: 'fallback',
          } satisfies FillerProgram;
          pushProgram(filler);
        } else {
          pushFlex(padMs);
        }
      } else {
        pushFlex(padMs);
      }
    });
  }

  return {
    lineup: channelPrograms,
    programs: contentProgramsById,
    startTime: +t0,
    seed,
  };
}
