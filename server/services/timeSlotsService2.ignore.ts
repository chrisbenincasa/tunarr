/* eslint-disable @typescript-eslint/no-unused-vars */
import dayjs from 'dayjs';
import duration, { Duration } from 'dayjs/plugin/duration.js';
import relativeTime from 'dayjs/plugin/relativeTime.js';
import utc from 'dayjs/plugin/utc.js';
import {
  ChannelProgram,
  ChannelProgramming,
  ContentProgram,
  FlexProgram,
  isContentProgram,
  isFlexProgram,
} from 'dizquetv-types';
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
import constants from '../constants.js';
import { TimeSlot, TimeSlotSchedule } from '../dao/derived_types/Lineup.js';
import { mod } from '../util/dayjsExtensions.js';

dayjs.extend(duration);
dayjs.extend(relativeTime);
dayjs.extend(mod);
dayjs.extend(utc);

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
  #programs: ChannelProgram[];
  #position: number = 0;

  constructor(programs: ChannelProgram[]) {
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

// async function initializePrograms(
//   channelProgramming: ChannelProgramming,
// ): Promise<ContentProgram[]> {
//   // Load programs
//   const em = getEm();
//   const minter = ProgramMinterFactory.create(em);
//   const allContent = filter(channelProgramming.programs, isContentProgram);
//   const [persistedContent, nonPersistedContent] = partition(
//     allContent,
//     (p) => p.persisted,
//   );
//   const nonPersistedOther = filter(
//     channelProgramming.programs,
//     (p) => !p.persisted && !isContentProgram(p) && !isFlexProgram(p),
//   );
//   const mintedContent: ContentProgram[] = map(
//     nonPersistedContent,
//     (p) => ({
//       ...p,
//       dbProgram: minter.mint(p.externalSourceName!, p.originalProgram!),
//     }),
//   );
//   // TODO should we batch this?
//   const loadedPrograms = await em
//     .repo(Program)
//     .find({ uuid: { $in: map(persistedContent, (p) => p.id!) } });

//   const existingPrograms: ContentProgram[] = compact(
//     map(persistedContent, (pc) => {
//       const match = find(loadedPrograms, (lp) => lp.uuid === pc.id);
//       if (!match) {
//         console.warn("Program claimed to be persisted by couldn't be found");
//         return;
//       }

//       return { ...pc, dbProgram: match };
//     }),
//   );

//   // TODO include redirects and custom programs!
//   return [...existingPrograms, ...mintedContent];
// }

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
export default async function scheduleTimeSlots(
  schedule: TimeSlotSchedule,
  channelProgramming: ChannelProgramming,
) {
  // Load programs
  // TODO include redirects and custom programs!
  const allPrograms = reject(channelProgramming.programs, isFlexProgram);
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
  let ChannelPrograms: ChannelProgram[] = [];

  const pushFlex = (flexDuration: Duration) => {
    const [inc, newPrograms] = pushOrExtendFlex(ChannelPrograms, flexDuration);
    timeCursor = timeCursor.add(inc);
    ChannelPrograms = newPrograms;
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

    console.log(timeCursor.format());
    const m = timeCursor.mod(schedule.padMs).asMilliseconds();
    if (m > constants.SLACK && schedule.padMs - m > constants.SLACK) {
      console.log('we need to pad the TS');
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
      console.log('we got a runner', dayjs.duration(lateMillis).format());
      pushFlex(dayjs.duration(remaining));
      continue;
    }

    if (isNull(program) || isFlexProgram(program)) {
      pushFlex(dayjs.duration(remaining));
      continue;
    }

    // Program longer than we have left? Add it and move on...
    if (program && program.duration > remaining) {
      ChannelPrograms.push(program);
      advanceIterator(currSlot, programmingIteratorsById);
      timeCursor = timeCursor.add(program.duration);
      continue;
    }

    const paddedProgram = createPaddedProgram(program, schedule.padMs);
    let totalDuration = paddedProgram.totalDuration;
    advanceIterator(currSlot, programmingIteratorsById);
    const paddedPrograms = [paddedProgram];

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
    } else {
      const lastProgram = last(paddedPrograms)!;
      lastProgram.padMs += remainingTimeInSlot;
      lastProgram.totalDuration += remainingTimeInSlot;
    }

    forEach(paddedPrograms, ({ program, padMs }) => {
      ChannelPrograms.push(program);
      timeCursor = timeCursor.add(program.duration);
      pushFlex(dayjs.duration(padMs));
    });
  }

  return {
    programs: ChannelPrograms,
    startTime: t0.unix() * 1000,
  };

  // while (timeCursor.isBefore(upperLimit)) {

  // }
}
