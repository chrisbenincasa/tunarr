/* eslint-disable @typescript-eslint/no-unused-vars */
import dayjs from 'dayjs';
import duration, { Duration } from 'dayjs/plugin/duration.js';
import relativeTime from 'dayjs/plugin/relativeTime.js';
import {
  ChannelProgramming,
  ContentProgram,
  FlexProgram,
  RedirectProgram,
  isContentProgram,
  isFlexProgram,
} from 'dizquetv-types';
import {
  compact,
  filter,
  find,
  first,
  forEach,
  last,
  map,
  nth,
  partition,
  reduce,
  shuffle,
  slice,
  sortBy,
} from 'lodash-es';
import { getEm } from '../dao/dataSource.js';
import {
  SlotProgramming,
  TimeSlot,
  TimeSlotSchedule,
} from '../dao/derived_types/Lineup.js';
import { Program } from '../dao/entities/Program.js';
import { mod } from '../util/dayjsExtensions.js';
import { ProgramMinterFactory } from '../util/programMinter.js';

dayjs.extend(duration);
dayjs.extend(relativeTime);
dayjs.extend(mod);

type WorkingContentProgram = ContentProgram & { dbProgram: Program };
type WorkingProgram = FlexProgram | RedirectProgram | WorkingContentProgram;

// Adds flex time to the end of a programs array.
// If the final program is flex itself, just extends it
// Returns a new array and amount to increment the cursor
function pushOrExtendFlex(
  lineup: WorkingProgram[],
  flexDuration: Duration,
): [number, WorkingProgram[]] {
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
  abstract current(): WorkingProgram;
  abstract next(): void;
  // eslint-disable-next-line require-yield
  *get(): Generator<WorkingProgram> {
    throw new Error('Not Implemented');
  }
}

class ProgramShuffler extends ProgramIterator {
  #programs: WorkingProgram[];
  #position: number = 0;

  constructor(programs: WorkingProgram[]) {
    super();
    this.#programs = shuffle(programs);
  }

  current() {
    return this.#programs[this.#position];
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

  *get() {
    while (true) {
      yield this.current();
      this.next();
    }
  }
}

function getProgramOrder(program: WorkingContentProgram): string | number {
  switch (program.subtype) {
    case 'movie':
      // A-z for now
      return program.title;
    case 'episode':
      // Hacky thing from original code...
      return program.dbProgram.season! * 100000 + program.dbProgram.episode!;
    case 'track':
      // A-z for now
      return program.title;
  }
}

class ProgramOrderer extends ProgramIterator {
  #slot: SlotProgramming;
  #programs: WorkingProgram[];
  #position: number = 0;

  constructor(slot: SlotProgramming, programs: WorkingProgram[]) {
    super();
    this.#slot = slot;
    this.#programs = sortBy(programs, getProgramOrder);
  }

  current(): WorkingProgram {
    return this.#programs[this.#position];
  }
  next(): void {
    this.#position = (this.#position + 1) % this.#programs.length;
  }
  *get() {
    while (true) {
      yield this.current();
      this.next();
    }
  }
}

async function initializePrograms(
  channelProgramming: ChannelProgramming,
): Promise<WorkingContentProgram[]> {
  // Load programs
  const em = getEm();
  const minter = ProgramMinterFactory.create(em);
  const allContent = filter(channelProgramming.programs, isContentProgram);
  const [persistedContent, nonPersistedContent] = partition(
    allContent,
    (p) => p.persisted,
  );
  const nonPersistedOther = filter(
    channelProgramming.programs,
    (p) => !p.persisted && !isContentProgram(p) && !isFlexProgram(p),
  );
  const mintedContent: WorkingContentProgram[] = map(
    nonPersistedContent,
    (p) => ({
      ...p,
      dbProgram: minter.mint(p.externalSourceName!, p.originalProgram!),
    }),
  );
  // TODO should we batch this?
  const loadedPrograms = await em
    .repo(Program)
    .find({ uuid: { $in: map(persistedContent, (p) => p.id!) } });

  const existingPrograms: WorkingContentProgram[] = compact(
    map(persistedContent, (pc) => {
      const match = find(loadedPrograms, (lp) => lp.uuid === pc.id);
      if (!match) {
        console.warn("Program claimed to be persisted by couldn't be found");
        return;
      }

      return { ...pc, dbProgram: match };
    }),
  );

  // TODO include redirects and custom programs!
  return [...existingPrograms, ...mintedContent];
}

function createProgramMap(programs: WorkingContentProgram[]) {
  return reduce(
    programs,
    (acc, program) => {
      let id: string;
      if (program.subtype === 'track') return acc; // TODO handle music
      if (program.subtype === 'movie') {
        id = 'movie';
      } else {
        id = `tv.${program.dbProgram.showTitle!}`;
      }

      const existing = acc[id] ?? [];
      acc[id] = [...existing, program];
      return acc;
    },
    {} as Record<string, WorkingContentProgram[]>,
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
) {
  switch (slot.programming.type) {
    case 'movie':
    case 'show':
      return iterators[slotIteratorKey(slot)!].current();
    case 'flex':
      return null;
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
  const allPrograms = await initializePrograms(channelProgramming);
  const programBySlotType = createProgramMap(allPrograms);

  const programmingSelectorById: Record<string, ProgramIterator> = {};
  forEach(schedule.slots, (slot) => {
    let id: string | null = null,
      slotId: string | null = null;
    if (slot.programming.type === 'movie') {
      id = `movie_${slot.order}`;
      slotId = 'movie';
    } else if (slot.programming.type === 'show') {
      id = `tv_${slot.programming.showId}_${slot.order}`;
      slotId = `tv.${slot.programming.showId}`;
    }

    if (id && slotId && !programmingSelectorById[id]) {
      const programs = programBySlotType[slotId];
      programmingSelectorById[id] =
        slot.order === 'next'
          ? new ProgramOrderer(slot.programming, programs)
          : new ProgramShuffler(programs);
    }
  });

  const periodDuration = dayjs.duration(1, schedule.period);
  const periodMs = dayjs.duration(1, schedule.period).asMilliseconds();
  // TODO validate

  const sortedSlots = sortBy(schedule.slots, (slot) => slot.startTime);
  const now = dayjs();
  const startOfCurrentPeriod = now.startOf(schedule.period);
  let t0 = startOfCurrentPeriod.add(
    first(schedule.slots)!.startTime,
    'millisecond',
  );
  if (schedule.startTomorrow) {
    t0 = t0.add(1, 'day');
  }
  const upperLimit = t0.add(schedule.maxDays + 1, 'day');

  let timeCursor = t0;
  let workingPrograms: WorkingProgram[] = [];

  const pushFlex = (flexDuration: Duration) => {
    const [inc, newPrograms] = pushOrExtendFlex(workingPrograms, flexDuration);
    timeCursor = timeCursor.add(inc);
    workingPrograms = newPrograms;
  };

  // if (now.isAfter(startOfCurrentPeriod)) {
  //   const d = dayjs.duration(now.diff(startOfCurrentPeriod));
  //   pushFlex(d);
  // }

  // const dayTime = timeCursor.subtract(
  //   (timeCursor.unix() * 1000) % schedule.padMs,
  // );

  let dayTime = timeCursor
    .mod(periodDuration)
    .subtract(schedule.timeZoneOffset, 'minutes')
    .asMilliseconds();

  let currSlot: TimeSlot | null = null;
  let remaining: number = 0;
  let lateMillis: number | null = null;

  let it = 0;
  while (timeCursor.isBefore(upperLimit) || it < 5) {
    console.log(timeCursor.format());
    const m = timeCursor.mod(schedule.padMs);
    console.log(m.format());

    for (let i = 0; i < schedule.slots.length; i++) {
      const slot = schedule.slots[i];
      let endTime: number;
      if (i === schedule.slots.length - 1) {
        endTime = first(schedule.slots)!.startTime + periodMs;
      } else {
        endTime = nth(schedule.slots, i + 1)!.startTime;
      }

      if (slot.startTime <= dayTime && dayTime < endTime) {
        currSlot = slot;
        remaining = endTime - dayTime;
        lateMillis = dayTime - currSlot.startTime;
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

    const program = getNextProgramForSlot(currSlot!, programmingSelectorById);

    if (program && program.duration > remaining) {
      workingPrograms.push(program);
      advanceIterator(currSlot!, programmingSelectorById);
      timeCursor = timeCursor.add(program.duration);
      continue;
    }

    // Late?

    it++;
  }

  return workingPrograms;

  // while (timeCursor.isBefore(upperLimit)) {

  // }
}
