import dayjs from '@/util/dayjs.js';
import type { CondensedChannelProgram } from '@tunarr/types';
import type {
  RandomSlotSchedule,
  TimeSlot,
  TimeSlotSchedule,
} from '@tunarr/types/api';
import { map, sumBy } from 'lodash-es';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { condensedProgramToLineupItem } from '../../db/channel/lineupItemConversion.ts';
import type { LineupItem } from '../../db/derived_types/Lineup.ts';
import {
  fixtureEpisodes,
  fixturePrograms,
  fixtureRandomSlotSchedule,
  fixtureSlotId,
  fixtureTimeSlotSchedule,
} from '../../testing/fakes/slotScheduleFixtures.ts';
import { RandomSlotScheduler } from './RandomSlotsService.ts';
import type {
  BuildCycleFn,
  BuiltCycle,
  CycleOptions,
  CycleSnapshot,
  CycleState,
} from './slotCycles.ts';
import {
  advanceCycles,
  cascadeCycles,
  cycleEndTime,
  cycleStartTime,
  initializeCycles,
} from './slotCycles.ts';
import type { SlotSchedulerProgram } from './slotSchedulerUtil.ts';
import { scheduleTimeSlots } from './TimeSlotService.ts';

// Period starts depend on the ambient zone, and the fixtures declare
// `timeZoneOffset: 0`. Pinning the process to UTC makes both agree, so the
// expectations below hold whatever zone the machine runs in.
let originalTz: string | undefined;

beforeAll(() => {
  originalTz = process.env.TZ;
  process.env.TZ = 'UTC';
});

afterAll(() => {
  if (originalTz === undefined) {
    delete process.env.TZ;
  } else {
    process.env.TZ = originalTz;
  }
});

const oneMinute = 60 * 1000;
const oneHour = 60 * oneMinute;
const oneDay = 24 * oneHour;

// Deliberately off every minute and hour boundary, so a rounded startTime
// write shows up as a failure.
const oddStart = 1_700_000_000_000 + 37_123;

const day1 = dayjs.utc('2024-03-04T00:00:00.000Z');

function totalDurationMs(items: readonly LineupItem[]) {
  return sumBy(items, (item) => item.durationMs);
}

function contentEnd(state: CycleState) {
  return state.startTime + totalDurationMs(state.items);
}

function contentIds(items: readonly LineupItem[]) {
  return items.flatMap((item) =>
    item.type === 'content' && item.id ? [item.id] : [],
  );
}

// The channel position as the streamer sees it: which item is on air at `now`
// and how far into it we are. Build-ahead and trim must never move it.
function positionAt(state: CycleState, now: number) {
  const total = totalDurationMs(state.items);
  expect(total).toBeGreaterThan(0);

  let offsetMs = (((now - state.startTime) % total) + total) % total;
  for (const item of state.items) {
    if (offsetMs < item.durationMs) {
      return { item, offsetMs };
    }
    offsetMs -= item.durationMs;
  }

  throw new Error('offset walked past the end of the lineup');
}

// How many leading cycles have finished by `now`, and the duration they carry.
// Re-derived from the spec rather than read back from the new state, so a
// wrong trim shows up as a startTime mismatch.
function expectedTrim(state: CycleState, now: number) {
  let start = state.startTime;
  let count = 0;
  for (const cycle of state.cycles) {
    if (start + cycle.durationMs > now) {
      break;
    }
    start += cycle.durationMs;
    count += 1;
  }
  return { durationMs: start - state.startTime, count };
}

function expectItemsMatchCycles(state: CycleState) {
  expect(state.items).toHaveLength(sumBy(state.cycles, (c) => c.itemCount));

  let index = 0;
  for (const cycle of state.cycles) {
    const slice = state.items.slice(index, index + cycle.itemCount);
    expect(totalDurationMs(slice)).toBe(cycle.durationMs);
    index += cycle.itemCount;
  }

  // Cycles hold the snapshot they started from, so the end snapshot of the
  // last one only lives in `nextSnapshot`.
  if (state.cycles.length > 0) {
    expect(state.nextSnapshot).toBeDefined();
  }
}

type FakeBuilder = {
  build: BuildCycleFn;
  calls: { startTime: number; snapshot: CycleSnapshot | undefined }[];
  results: BuiltCycle[];
  setLibrary(library: string): void;
};

// Fixed-length cycles with content that names the library version and the
// start time it was built for, so a rebuilt cycle is distinguishable from the
// cycle it replaced.
function fakeBuilder(opts: {
  cycleMs: number;
  itemMs?: number;
  library?: string;
}): FakeBuilder {
  const itemMs = opts.itemMs ?? oneHour;
  const count = Math.round(opts.cycleMs / itemMs);
  expect(count * itemMs).toBe(opts.cycleMs);

  let library = opts.library ?? 'v1';
  const calls: FakeBuilder['calls'] = [];
  const results: BuiltCycle[] = [];

  const build: BuildCycleFn = (startTime, snapshot) => {
    calls.push({ startTime, snapshot });

    const items: LineupItem[] = Array.from({ length: count }, (_, i) => ({
      type: 'content',
      id: `${library}@${startTime}#${i}`,
      durationMs: itemMs,
    }));

    const result: BuiltCycle = {
      items,
      durationMs: opts.cycleMs,
      endSnapshot: {
        discardCount: (snapshot?.discardCount ?? 0) + count,
        iteratorState: {
          iterators: {
            main: {
              type: 'ordered',
              lastProgramId: `${library}@${startTime}#${count - 1}`,
            },
          },
        },
      },
    };
    results.push(result);
    return Promise.resolve(result);
  };

  return {
    build,
    calls,
    results,
    setLibrary(next: string) {
      library = next;
    },
  };
}

function toBuiltCycle(result: {
  lineup: CondensedChannelProgram[];
  discardCount: number;
  iteratorState: CycleSnapshot['iteratorState'];
}): BuiltCycle {
  const items = map(result.lineup, condensedProgramToLineupItem);
  return {
    items,
    durationMs: totalDurationMs(items),
    endSnapshot: {
      discardCount: result.discardCount,
      iteratorState: result.iteratorState,
    },
  };
}

function timeSlotBuilder(
  schedule: TimeSlotSchedule,
  programs: () => SlotSchedulerProgram[],
  seed: number[] = [42],
): BuildCycleFn {
  return async (startTime, snapshot) =>
    toBuiltCycle(
      await scheduleTimeSlots(
        schedule,
        programs(),
        seed,
        snapshot?.discardCount ?? 0,
        dayjs.utc(startTime),
        {
          iteratorState: snapshot?.iteratorState,
          endTime: dayjs.utc(cycleEndTime(schedule, startTime)),
        },
      ),
    );
}

function randomSlotBuilder(
  schedule: RandomSlotSchedule,
  programs: () => SlotSchedulerProgram[],
  seed: number[] = [42],
): BuildCycleFn {
  return (startTime, snapshot) =>
    Promise.resolve(
      toBuiltCycle(
        new RandomSlotScheduler(schedule).generateSchedule(
          programs(),
          seed,
          snapshot?.discardCount ?? 0,
          dayjs.utc(startTime),
          {
            iteratorState: snapshot?.iteratorState,
            endTime: dayjs.utc(cycleEndTime(schedule, startTime)),
          },
        ),
      ),
    );
}

function showSlot(order: 'next' | 'shuffle' | 'ordered_shuffle'): TimeSlot {
  return {
    id: fixtureSlotId(1),
    startTime: 0,
    type: 'show',
    showId: 'show',
    order,
    direction: 'asc',
    seasonFilter: [],
    seasonExcludeFilter: [],
  };
}

// One slot covering the whole day, so a day cycle is 24 hour-long episodes.
function singleSlotDaySchedule(
  order: 'next' | 'shuffle' | 'ordered_shuffle',
): TimeSlotSchedule {
  return fixtureTimeSlotSchedule({
    padMs: 1,
    maxDays: 365,
    slots: [showSlot(order)],
  });
}

const episodeIds = (count: number) =>
  map(fixtureEpisodes('show', count, oneHour), (program) => program.uuid);

describe('cycleEndTime', () => {
  test('a time slot cycle is one period, ignoring maxDays', () => {
    const daily = fixtureTimeSlotSchedule({ period: 'day', maxDays: 6 });
    expect(cycleEndTime(daily, oddStart)).toBe(+dayjs(oddStart).add(1, 'day'));
    expect(cycleEndTime(daily, oddStart)).toBe(oddStart + oneDay);

    const weekly = fixtureTimeSlotSchedule({ period: 'week', maxDays: 2 });
    expect(cycleEndTime(weekly, oddStart)).toBe(
      +dayjs(oddStart).add(1, 'week'),
    );
  });

  test('a random slot cycle is maxDays long', () => {
    const schedule = fixtureRandomSlotSchedule({ maxDays: 3 });
    expect(cycleEndTime(schedule, oddStart)).toBe(
      +dayjs(oddStart).add(3, 'day'),
    );
  });
});

describe('cycleStartTime', () => {
  const now = +dayjs.utc('2024-03-06T13:47:19.531Z');

  test('time slots start at the period start', () => {
    const daily = fixtureTimeSlotSchedule({ period: 'day' });
    const start = cycleStartTime(daily, now);
    expect(start).toBe(+dayjs(now).startOf('day'));
    expect(start).toBeLessThanOrEqual(now);
    // A period start maps to itself.
    expect(cycleStartTime(daily, start)).toBe(start);

    const weekly = fixtureTimeSlotSchedule({ period: 'week' });
    expect(cycleStartTime(weekly, now)).toBe(+dayjs(now).startOf('week'));
  });

  test('random slots start at now, floored to the minute', () => {
    const schedule = fixtureRandomSlotSchedule();
    const start = cycleStartTime(schedule, now);
    expect(start).toBe(+dayjs(now).startOf('minute'));
    expect(now - start).toBeLessThan(oneMinute);
  });
});

describe('initializeCycles', () => {
  test('builds past the horizon from a fresh start', async () => {
    const builder = fakeBuilder({ cycleMs: 4 * oneHour });
    const state = await initializeCycles(oddStart, {
      now: oddStart,
      horizonMs: 6 * oneHour,
      build: builder.build,
    });

    expect(state.startTime).toBe(oddStart);
    expect(state.cycles).toHaveLength(2);
    expect(contentEnd(state)).toBeGreaterThan(oddStart + 6 * oneHour);
    expectItemsMatchCycles(state);

    // The first cycle starts fresh; every later cycle resumes from the
    // previous cycle's end snapshot.
    expect(builder.calls[0]).toEqual({
      startTime: oddStart,
      snapshot: undefined,
    });
    expect(builder.calls[1]).toEqual({
      startTime: oddStart + 4 * oneHour,
      snapshot: builder.results[0]?.endSnapshot,
    });
    expect(state.cycles[1]?.snapshot).toEqual(builder.results[0]?.endSnapshot);
    expect(state.nextSnapshot).toEqual(builder.results[1]?.endSnapshot);
  });

  test('a cycle shorter than the horizon builds enough cycles to cover it', async () => {
    const builder = fakeBuilder({
      cycleMs: 30 * oneMinute,
      itemMs: 10 * oneMinute,
    });
    const horizonMs = 5 * oneHour;
    const state = await initializeCycles(oddStart, {
      now: oddStart,
      horizonMs,
      build: builder.build,
    });

    // Ten cycles land exactly on the horizon, which is not past it.
    expect(state.cycles).toHaveLength(11);
    expect(contentEnd(state)).toBe(oddStart + 11 * 30 * oneMinute);
    expect(contentEnd(state)).toBeGreaterThan(oddStart + horizonMs);
    expectItemsMatchCycles(state);
  });
});

describe('advanceCycles', () => {
  test('build ahead and trim keep the channel position unchanged', async () => {
    const cycleMs = 4 * oneHour;
    const horizonMs = 6 * oneHour;
    const builder = fakeBuilder({ cycleMs });
    const opts = (now: number): CycleOptions => ({
      now,
      horizonMs,
      build: builder.build,
    });

    let state = await initializeCycles(oddStart, opts(oddStart));
    let trimmedSoFar = 0;

    for (let step = 1; step <= 12; step++) {
      const now = oddStart + step * 90 * oneMinute;
      const before = positionAt(state, now);
      const previous = state;
      const trim = expectedTrim(previous, now);

      const advanced = await advanceCycles(previous, now, opts(now));
      state = advanced.state;

      // Position: the same item, at the same offset into it.
      expect(positionAt(state, now)).toEqual(before);

      // startTime moved by exactly the trimmed durations, with no rounding.
      trimmedSoFar += trim.durationMs;
      expect(state.startTime).toBe(oddStart + trimmedSoFar);
      expect(state.cycles.length).toBeGreaterThanOrEqual(
        previous.cycles.length - trim.count,
      );

      // Items are the concatenation of the remaining cycles: the kept tail of
      // the old items, then whatever was appended.
      const trimmedItems = sumBy(
        previous.cycles.slice(0, trim.count),
        (cycle) => cycle.itemCount,
      );
      const kept = previous.items.slice(trimmedItems);
      expect(state.items.slice(0, kept.length)).toEqual(kept);
      expectItemsMatchCycles(state);

      expect(contentEnd(state)).toBeGreaterThan(now + horizonMs);
      expect(state.startTime).toBeLessThanOrEqual(now);
    }

    // Several boundaries were actually crossed.
    expect(trimmedSoFar).toBeGreaterThanOrEqual(3 * cycleMs);
  });

  test('reports no change when the horizon is already covered', async () => {
    const builder = fakeBuilder({ cycleMs: 4 * oneHour });
    const state = await initializeCycles(oddStart, {
      now: oddStart,
      horizonMs: 6 * oneHour,
      build: builder.build,
    });
    const callsAfterInit = builder.calls.length;

    const advanced = await advanceCycles(state, oddStart, {
      now: oddStart + oneMinute,
      horizonMs: 6 * oneHour,
      build: builder.build,
    });

    expect(advanced.changed).toBe(false);
    expect(advanced.state.startTime).toBe(oddStart);
    expect(advanced.state.items).toEqual(state.items);
    expect(builder.calls).toHaveLength(callsAfterInit);
  });

  test('reports a change when it trims or builds', async () => {
    const builder = fakeBuilder({ cycleMs: 4 * oneHour });
    const state = await initializeCycles(oddStart, {
      now: oddStart,
      horizonMs: 6 * oneHour,
      build: builder.build,
    });

    const now = oddStart + 5 * oneHour;
    const advanced = await advanceCycles(state, now, {
      now,
      horizonMs: 6 * oneHour,
      build: builder.build,
    });

    expect(advanced.changed).toBe(true);
    expect(advanced.state.startTime).toBe(oddStart + 4 * oneHour);
  });
});

describe('catch-up', () => {
  test('restarts at catchUpStart from the stored next snapshot', async () => {
    const cycleMs = 4 * oneHour;
    const builder = fakeBuilder({ cycleMs });
    const state = await initializeCycles(oddStart, {
      now: oddStart,
      horizonMs: 2 * oneHour,
      build: builder.build,
    });
    const staleSnapshot = state.nextSnapshot;
    const callsBefore = builder.calls.length;

    // Everything built has aired.
    const now = contentEnd(state) + 3 * oneDay;
    const catchUpStart = now - 17 * oneMinute;
    const advanced = await advanceCycles(state, catchUpStart, {
      now,
      horizonMs: 2 * oneHour,
      build: builder.build,
    });

    expect(advanced.changed).toBe(true);
    expect(advanced.state.startTime).toBe(catchUpStart);
    expect(builder.calls[callsBefore]).toEqual({
      startTime: catchUpStart,
      snapshot: staleSnapshot,
    });
    expect(advanced.state.cycles[0]?.snapshot).toEqual(staleSnapshot);
    expect(contentEnd(advanced.state)).toBeGreaterThan(now + 2 * oneHour);
    expectItemsMatchCycles(advanced.state);
  });

  test('an empty state builds from catchUpStart', async () => {
    const builder = fakeBuilder({ cycleMs: 2 * oneHour });
    const empty: CycleState = {
      startTime: oddStart,
      items: [],
      cycles: [],
      nextSnapshot: undefined,
    };
    const now = oddStart + oneDay;
    const catchUpStart = now - oneMinute;

    const advanced = await advanceCycles(empty, catchUpStart, {
      now,
      horizonMs: oneHour,
      build: builder.build,
    });

    expect(advanced.changed).toBe(true);
    expect(advanced.state.startTime).toBe(catchUpStart);
    expect(builder.calls[0]).toEqual({
      startTime: catchUpStart,
      snapshot: undefined,
    });
  });

  test('a time slot catch-up continues the ordered show', async () => {
    const schedule = singleSlotDaySchedule('next');
    const build = timeSlotBuilder(schedule, () =>
      fixtureEpisodes('show', 30, oneHour),
    );
    const start = +day1;
    const state = await initializeCycles(start, {
      now: start,
      horizonMs: oneDay,
      build,
    });
    expect(state.cycles).toHaveLength(2);

    // 48 episodes aired over two cycles, so the pass ended on episode 18.
    const all = episodeIds(30);
    expect(contentIds(state.items).at(-1)).toBe(all[47 % 30]);

    const now = +day1.add(9, 'day').add(13, 'hour');
    const catchUpStart = cycleStartTime(schedule, now);
    expect(catchUpStart).toBe(+dayjs(now).startOf('day'));

    const advanced = await advanceCycles(state, catchUpStart, {
      now,
      horizonMs: oneHour,
      build,
    });

    expect(advanced.state.startTime).toBe(catchUpStart);
    // The new cycle picks up after the last aired episode instead of
    // restarting the show.
    expect(contentIds(advanced.state.items)[0]).toBe(all[48 % 30]);
  });

  test('a random slot catch-up starts at now, floored to the minute', async () => {
    const schedule = fixtureRandomSlotSchedule({ maxDays: 1 });
    const build = randomSlotBuilder(schedule, fixturePrograms);
    const start = +day1;
    const state = await initializeCycles(start, {
      now: start,
      horizonMs: oneHour,
      build,
    });

    const now = contentEnd(state) + 2 * oneDay + 31_777;
    const catchUpStart = cycleStartTime(schedule, now);
    expect(catchUpStart).toBe(+dayjs(now).startOf('minute'));

    const advanced = await advanceCycles(state, catchUpStart, {
      now,
      horizonMs: oneHour,
      build,
    });

    expect(advanced.state.startTime).toBe(catchUpStart);
    expect(advanced.state.cycles[0]?.snapshot).toEqual(state.nextSnapshot);
    expect(contentEnd(advanced.state)).toBeGreaterThan(now + oneHour);
  });
});

describe('cascadeCycles', () => {
  test('rebuilds later cycles from the new end state and keeps startTime', async () => {
    const cycleMs = 4 * oneHour;
    const horizonMs = 10 * oneHour;
    const builder = fakeBuilder({ cycleMs, library: 'v1' });
    const opts = (now: number): CycleOptions => ({
      now,
      horizonMs,
      build: builder.build,
    });

    const state = await initializeCycles(oddStart, opts(oddStart));
    expect(state.cycles).toHaveLength(3);
    const firstSnapshot = state.cycles[0]?.snapshot;

    // The library changed under the channel.
    builder.setLibrary('v2');
    const callsBefore = builder.calls.length;
    const now = oddStart + oneHour;
    const cascaded = await cascadeCycles(state, opts(now));

    expect(cascaded.startTime).toBe(oddStart);
    expect(cascaded.cycles).toHaveLength(3);
    expect(cascaded.cycles[0]?.snapshot).toEqual(firstSnapshot);
    expectItemsMatchCycles(cascaded);

    // Cycle 0 was rebuilt at the old start, and cycle 1 started from cycle 0's
    // new end snapshot, not the one it held before.
    const rebuilds = builder.calls.slice(callsBefore);
    const newCycle0 = builder.results[callsBefore];
    expect(rebuilds[0]).toEqual({
      startTime: oddStart,
      snapshot: firstSnapshot,
    });
    expect(rebuilds[1]).toEqual({
      startTime: oddStart + cycleMs,
      snapshot: newCycle0?.endSnapshot,
    });
    expect(cascaded.cycles[1]?.snapshot).toEqual(newCycle0?.endSnapshot);
    expect(cascaded.cycles[1]?.snapshot).not.toEqual(state.cycles[1]?.snapshot);

    // Every item comes from the new library.
    expect(contentIds(cascaded.items).every((id) => id.startsWith('v2@'))).toBe(
      true,
    );
    expect(contentEnd(cascaded)).toBeGreaterThan(now + horizonMs);
  });
});

describe('zero-length cycles', () => {
  test('a builder returning durationMs 0 does not loop forever', async () => {
    let calls = 0;
    const build: BuildCycleFn = (_startTime, snapshot) => {
      calls += 1;
      return Promise.resolve({
        items: [],
        durationMs: 0,
        endSnapshot: {
          discardCount: snapshot?.discardCount ?? 0,
          iteratorState: { iterators: {} },
        },
      });
    };

    const state = await initializeCycles(oddStart, {
      now: oddStart,
      horizonMs: oneDay,
      build,
    });

    expect(state.cycles).toHaveLength(0);
    expect(state.items).toHaveLength(0);
    expect(calls).toBeLessThanOrEqual(2);

    const advanced = await advanceCycles(state, oddStart, {
      now: oddStart,
      horizonMs: oneDay,
      build,
    });
    expect(advanced.state.cycles).toHaveLength(0);
    expect(calls).toBeLessThanOrEqual(4);
  });

  test('stops appending once a cycle comes back empty', async () => {
    const good = fakeBuilder({ cycleMs: 2 * oneHour });
    let calls = 0;
    const build: BuildCycleFn = (startTime, snapshot) => {
      calls += 1;
      if (calls <= 2) {
        return good.build(startTime, snapshot);
      }
      return Promise.resolve({
        items: [],
        durationMs: 0,
        endSnapshot: {
          discardCount: snapshot?.discardCount ?? 0,
          iteratorState: { iterators: {} },
        },
      });
    };

    const state = await initializeCycles(oddStart, {
      now: oddStart,
      horizonMs: oneDay,
      build,
    });

    expect(state.cycles).toHaveLength(2);
    expect(contentEnd(state)).toBe(oddStart + 4 * oneHour);
    expect(calls).toBeLessThanOrEqual(4);
    expectItemsMatchCycles(state);
  });
});

describe('content across cycles', () => {
  test('an ordered show continues across cycles', async () => {
    const schedule = singleSlotDaySchedule('next');
    const build = timeSlotBuilder(schedule, () =>
      fixtureEpisodes('show', 30, oneHour),
    );
    const start = +day1;
    const state = await initializeCycles(start, {
      now: start,
      horizonMs: 2 * oneDay - 1,
      build,
    });

    expect(state.cycles).toHaveLength(2);
    const all = episodeIds(30);
    const ids = contentIds(state.items);
    expect(ids.slice(0, 24)).toEqual(all.slice(0, 24));
    expect(ids.slice(24, 32)).toEqual([...all.slice(24), ...all.slice(0, 2)]);
  });

  test('ordered_shuffle keeps its place across cycles', async () => {
    const schedule = singleSlotDaySchedule('ordered_shuffle');
    const build = timeSlotBuilder(schedule, () =>
      fixtureEpisodes('show', 30, oneHour),
    );
    const start = +day1;
    const state = await initializeCycles(start, {
      now: start,
      horizonMs: 2 * oneDay - 1,
      build,
    });

    const all = episodeIds(30);
    const firstCycleItems = state.cycles[0]?.itemCount ?? 0;
    const ids = contentIds(state.items);
    const lastOfFirst = contentIds(state.items.slice(0, firstCycleItems)).at(
      -1,
    );
    const expected = all[(all.indexOf(lastOfFirst ?? '') + 1) % all.length];

    expect(firstCycleItems).toBeGreaterThan(0);
    expect(ids[firstCycleItems]).toBe(expected);
  });

  test('a shuffled show plays every episode before repeating', async () => {
    const schedule = singleSlotDaySchedule('shuffle');
    const build = timeSlotBuilder(schedule, () =>
      fixtureEpisodes('show', 30, oneHour),
    );
    const start = +day1;
    const state = await initializeCycles(start, {
      now: start,
      horizonMs: 2 * oneDay - 1,
      build,
    });

    const ids = contentIds(state.items);
    expect(ids.length).toBeGreaterThanOrEqual(30);
    expect(new Set(ids.slice(0, 30))).toEqual(new Set(episodeIds(30)));
  });

  test('the same seed and library give the same cycles', async () => {
    const schedule = fixtureTimeSlotSchedule();
    const start = +day1;
    const run = () =>
      initializeCycles(start, {
        now: start,
        horizonMs: 2 * oneDay,
        build: timeSlotBuilder(schedule, fixturePrograms, [7, 7, 7]),
      });

    const first = await run();
    const second = await run();

    expect(first.cycles.length).toBeGreaterThanOrEqual(3);
    expect(second).toEqual(first);
  });

  test('random slot cycles are reproducible from the same seed', async () => {
    const schedule = fixtureRandomSlotSchedule({ maxDays: 1 });
    const start = +day1;
    const run = () =>
      initializeCycles(start, {
        now: start,
        horizonMs: 2 * oneDay,
        build: randomSlotBuilder(schedule, fixturePrograms, [11]),
      });

    const first = await run();
    const second = await run();

    expect(first.cycles.length).toBeGreaterThanOrEqual(3);
    expect(second).toEqual(first);
  });
});
