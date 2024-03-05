/* eslint-disable @typescript-eslint/no-unused-vars */
import dayjs from 'dayjs';
import duration, { Duration } from 'dayjs/plugin/duration.js';
import relativeTime from 'dayjs/plugin/relativeTime.js';
import utc from 'dayjs/plugin/utc.js';
import {
  ChannelProgram,
  ContentProgram,
  FlexProgram,
  isContentProgram,
  isFlexProgram,
} from '@tunarr/types';
import { TimeSlot, TimeSlotSchedule } from '@tunarr/types/api';
import {
  chain,
  first,
  forEach,
  isNull,
  last,
  nth,
  reduce,
  reject,
  shuffle,
  slice,
  sortBy,
} from 'lodash-es';
import constants from '../util/constants.js';
import { mod } from '../util/dayjsExtensions.js';

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
// Returns a new array and amount to increment the cursor
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
    return [durationMs, [...slice(lineup, 0, lineup.length - 1), newItem]];
  }

  const newItem: FlexProgram = {
    type: 'flex',
    persisted: false,
    duration: durationMs,
  };

  return [durationMs, [...lineup, newItem]];
}

abstract class ProgramIterator {
  abstract current(): ChannelProgram | null;
  abstract next(): void;
}

class ProgramShuffler extends ProgramIterator {
  #programs: ChannelProgram[];
  #position: number = 0;

  constructor(programs: ChannelProgram[]) {
    super();
    this.#programs = shuffle(programs);
  }

  current() {
    return nth(this.#programs, this.#position) ?? null;
  }

  next() {
    this.#position++;
    if (this.#position >= this.#programs.length) {
      const mid = Math.floor(this.#programs.length / 2);
      this.#programs = [
        ...slice(this.#programs, 0, mid),
        ...slice(this.#programs, mid),
      ];
      this.#position = 0;
    }
  }
}

class ProgramOrderer extends ProgramIterator {
  #programs: ContentProgram[];
  #position: number = 0;

  constructor(programs: ContentProgram[]) {
    super();
    this.#programs = sortBy(programs, getProgramOrder);
  }

  current(): ChannelProgram | null {
    return nth(this.#programs, this.#position) ?? null;
  }
  next(): void {
    this.#position = (this.#position + 1) % this.#programs.length;
  }
}

function getProgramOrder(program: ContentProgram): string | number {
  switch (program.subtype) {
    case 'movie':
      // A-z for now
      return program.title;
    case 'episode':
      // Hacky thing from original code...
      return program.seasonNumber! * 100000 + program.episodeNumber!;
    case 'track':
      // A-z for now
      return program.title;
  }
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
  schedule: TimeSlotSchedule,
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
  const sortedPads = chain(programs)
    .map(({ padMs }, index) => ({ padMs, index }))
    .sortBy(({ padMs }) => padMs)
    .value();

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

function createProgramMap(programs: ChannelProgram[]) {
  return reduce(
    programs,
    (acc, program) => {
      if (isContentProgram(program)) {
        let id: string;
        if (program.subtype === 'track') return acc; // TODO handle music
        if (program.subtype === 'movie') {
          id = 'movie';
        } else {
          id = `tv.${program.title}`;
        }

        const existing = acc[id] ?? [];
        acc[id] = [...existing, program];
      }
      return acc;
    },
    {} as Record<string, ContentProgram[]>,
  );
}

function slotIteratorKey(slot: TimeSlot) {
  if (slot.programming.type === 'movie') {
    return `movie_${slot.order}`;
  } else if (slot.programming.type === 'show') {
    return `tv_${slot.programming.showId}_${slot.order}`;
  }

  return null;
}

function getNextProgramForSlot(
  slot: TimeSlot,
  iterators: Record<string, ProgramIterator>,
  duration: number,
): ChannelProgram | null {
  switch (slot.programming.type) {
    case 'movie':
    case 'show':
      return iterators[slotIteratorKey(slot)!].current();
    case 'flex':
      return {
        type: 'flex',
        duration,
        persisted: false,
      };
  }
}

function advanceIterator(
  slot: TimeSlot,
  iterators: Record<string, ProgramIterator>,
) {
  switch (slot.programming.type) {
    case 'movie':
    case 'show':
      iterators[slotIteratorKey(slot)!].next();
      return;
    case 'flex':
      return;
  }
}

// eslint-disable-next-line @typescript-eslint/require-await
export async function scheduleTimeSlots(
  schedule: TimeSlotSchedule,
  channelProgramming: ChannelProgram[],
) {
  // Load programs
  // TODO include redirects and custom programs!
  const allPrograms = reject<ChannelProgram>(channelProgramming, isFlexProgram);
  const programBySlotType = createProgramMap(allPrograms);

  const programmingIteratorsById = reduce(
    schedule.slots,
    (acc, slot) => {
      let id: string | null = null,
        slotId: string | null = null;
      if (slot.programming.type === 'movie') {
        id = `movie_${slot.order}`;
        slotId = 'movie';
      } else if (slot.programming.type === 'show') {
        id = `tv_${slot.programming.showId}_${slot.order}`;
        slotId = `tv.${slot.programming.showId}`;
      }

      if (id && slotId && !acc[id]) {
        const programs = programBySlotType[slotId];
        acc[id] =
          slot.order === 'next'
            ? new ProgramOrderer(programs)
            : new ProgramShuffler(programs);
      }
      return acc;
    },
    {} as Record<string, ProgramIterator>,
  );

  const periodDuration = dayjs.duration(1, schedule.period);
  const periodMs = dayjs.duration(1, schedule.period).asMilliseconds();
  // TODO validate

  const sortedSlots = chain(schedule.slots)
    .sortBy((slot) => slot.startTime)
    .map((slot) => ({
      ...slot,
      startTime:
        slot.startTime +
        dayjs.duration(schedule.timeZoneOffset, 'minutes').asMilliseconds(),
    }))
    .value();

  const now = dayjs.utc();
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
  let channelPrograms: ChannelProgram[] = [];

  const pushFlex = (flexDuration: Duration) => {
    const [inc, newPrograms] = pushOrExtendFlex(channelPrograms, flexDuration);
    timeCursor = timeCursor.add(inc);
    channelPrograms = newPrograms;
  };

  // if (t0.isAfter(startOfCurrentPeriod)) {
  //   const d = dayjs.duration(t0.diff(startOfCurrentPeriod));
  //   pushFlex(d);
  // }

  // const dayTime = timeCursor.subtract(
  //   (timeCursor.unix() * 1000) % schedule.padMs,
  // );

  while (timeCursor.isBefore(upperLimit)) {
    let dayTime = timeCursor.mod(periodDuration).asMilliseconds();

    let currSlot: TimeSlot | null = null;
    let remaining: number = 0;
    let lateMillis: number | null = null;

    const m = timeCursor.mod(schedule.padMs).asMilliseconds();
    if (m > constants.SLACK && schedule.padMs - m > constants.SLACK) {
      pushFlex(dayjs.duration(schedule.padMs - m));
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

      if (slot.startTime <= dayTime && dayTime < endTime) {
        currSlot = slot;
        remaining = endTime - dayTime;
        lateMillis = dayTime - slot.startTime;
        break;
      }

      const dayTimeNextPeriod = dayjs
        .duration(dayTime)
        .add(periodDuration)
        .asMilliseconds();
      if (slot.startTime <= dayTimeNextPeriod && dayTimeNextPeriod < endTime) {
        currSlot = slot;
        dayTime = dayTimeNextPeriod;
        remaining = endTime - dayTime;
        lateMillis = dayTime + periodDuration.asMilliseconds() - slot.startTime;
        break;
      }
    }

    if (isNull(currSlot)) {
      throw new Error('Could not find a suitable slot');
    }

    const program = getNextProgramForSlot(
      currSlot,
      programmingIteratorsById,
      remaining,
    );

    // if (isNull(program)) {
    // pushFlex()
    // continue;
    // }

    // TODO Late?
    if (
      !isNull(lateMillis) &&
      lateMillis >= schedule.latenessMs + constants.SLACK
    ) {
      pushFlex(dayjs.duration(remaining));
      continue;
    }

    if (isNull(program) || isFlexProgram(program)) {
      pushFlex(dayjs.duration(remaining));
      continue;
    }

    // Program longer than we have left? Add it and move on...
    if (program && program.duration > remaining) {
      channelPrograms.push(program);
      advanceIterator(currSlot, programmingIteratorsById);
      timeCursor = timeCursor.add(program.duration);
      continue;
    }

    const paddedProgram = createPaddedProgram(program, schedule.padMs);
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
      const nextPadded = createPaddedProgram(nextProgram, schedule.padMs);
      paddedPrograms.push(nextPadded);
      advanceIterator(currSlot, programmingIteratorsById);
      totalDuration += nextPadded.totalDuration;
    }

    const remainingTimeInSlot = Math.max(0, remaining - totalDuration);

    // We have two options here if there is remaining time in the slot
    // If we want to be "greedy", we can keep attempting to look for items
    // to fill the time for this slot. This works mainly if we're doing a
    // "shuffle" ordering, it won't work for "in order" shows in slots.
    // TODO: Implement greedy filling.
    if (schedule.flexPreference === 'distribute') {
      distributeFlex(paddedPrograms, schedule, remainingTimeInSlot);
    } else {
      const lastProgram = last(paddedPrograms)!;
      lastProgram.padMs += remainingTimeInSlot;
      lastProgram.totalDuration += remainingTimeInSlot;
    }

    forEach(paddedPrograms, ({ program, padMs }) => {
      channelPrograms.push(program);
      timeCursor = timeCursor.add(program.duration);
      pushFlex(dayjs.duration(padMs));
    });
  }

  return {
    programs: channelPrograms,
    startTime: t0.unix() * 1000,
  };
}
