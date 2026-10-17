import dayjs from '@/util/dayjs.js';
import type {
  RandomSlotSchedule,
  TimeSlot,
  TimeSlotSchedule,
} from '@tunarr/types/api';
import { MersenneTwister19937, Random } from 'random-js';
import { describe, expect, test } from 'vitest';
import {
  fixtureEpisodes,
  fixtureSlotId,
} from '../../testing/fakes/slotScheduleFixtures.ts';
import {
  WorkerRequest,
  WorkerSuccessReply,
} from '../../types/worker_schemas.ts';
import { ContentProgramChunkedShuffle } from './ProgramChunkedShuffle.ts';
import { getProgramOrderer, RerunProgramIterator } from './ProgramIterator.ts';
import { ContentProgramOrderedIterator } from './ProgramOrdereredIterator.ts';
import { RandomSlotScheduler } from './RandomSlotsService.ts';
import { ContentProgramShuffleIterator } from './ShuffleProgramIterator.ts';
import type { SlotSchedulerProgram } from './slotSchedulerUtil.ts';
import { scheduleTimeSlots } from './TimeSlotService.ts';

const oneHour = 60 * 60 * 1000;
const oneDay = 24 * oneHour;
const day1 = dayjs.utc('2024-03-04T00:00:00.000Z');
const state = { slotDuration: oneHour, timeCursor: 0 };

function ids(programs: SlotSchedulerProgram[]) {
  return programs.map((program) => program.uuid);
}

function contentIds(lineup: { type: string; id?: string }[]) {
  return lineup.flatMap((item) =>
    item.type === 'content' && item.id ? [item.id] : [],
  );
}

function take(
  iterator: { current: (s: typeof state) => { id?: string } | null } & {
    next: () => void;
  },
  count: number,
) {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const curr = iterator.current(state);
    if (curr?.id) {
      out.push(curr.id);
    }
    iterator.next();
  }
  return out;
}

function random(seed = 7) {
  return new Random(MersenneTwister19937.seed(seed));
}

describe('ordered iterator resume', () => {
  test('continues after the last played program', () => {
    const episodes = fixtureEpisodes('show', 5, oneHour);
    const first = new ContentProgramOrderedIterator(
      episodes,
      getProgramOrderer('next'),
    );
    expect(take(first, 2)).toEqual(['show-ep1', 'show-ep2']);

    const resumed = new ContentProgramOrderedIterator(
      episodes,
      getProgramOrderer('next'),
      true,
      first.snapshot(),
    );
    expect(take(resumed, 4)).toEqual([
      'show-ep3',
      'show-ep4',
      'show-ep5',
      'show-ep1',
    ]);
  });

  test('starts over when the last played program is gone', () => {
    const resumed = new ContentProgramOrderedIterator(
      fixtureEpisodes('show', 5, oneHour),
      getProgramOrderer('next'),
      true,
      { type: 'ordered', lastProgramId: 'deleted' },
    );
    expect(take(resumed, 1)).toEqual(['show-ep1']);
  });

  test('keeps the incoming state when nothing plays', () => {
    const snapshot = { type: 'ordered', lastProgramId: 'show-ep2' } as const;
    const resumed = new ContentProgramOrderedIterator(
      fixtureEpisodes('show', 5, oneHour),
      getProgramOrderer('next'),
      true,
      snapshot,
    );
    expect(resumed.snapshot()).toEqual(snapshot);
  });

  test('a rerun group reports its inner iterator state', () => {
    const inner = new ContentProgramOrderedIterator(
      fixtureEpisodes('show', 5, oneHour),
      getProgramOrderer('next'),
    );
    const rerun = new RerunProgramIterator(inner, 2);
    rerun.next();
    rerun.next();
    expect(rerun.snapshot()).toEqual({
      type: 'ordered',
      lastProgramId: 'show-ep1',
    });
  });
});

describe('ordered_shuffle resume', () => {
  test('continues in sorted order after the last played program', () => {
    const episodes = fixtureEpisodes('show', 8, oneHour);
    const first = new ContentProgramChunkedShuffle(
      episodes,
      getProgramOrderer('next'),
      random(),
    );
    const played = take(first, 3);
    const lastIndex = ids(episodes).indexOf(played[2] ?? '');

    const resumed = new ContentProgramChunkedShuffle(
      episodes,
      getProgramOrderer('next'),
      random(99),
      true,
      first.snapshot(),
    );
    const expected = [1, 2, 3].map(
      (offset) => episodes[(lastIndex + offset) % episodes.length]?.uuid,
    );
    expect(take(resumed, 3)).toEqual(expected);
  });
});

describe('shuffle resume', () => {
  test('plays the unplayed programs before any repeat', () => {
    const episodes = fixtureEpisodes('show', 10, oneHour);
    const first = new ContentProgramShuffleIterator([...episodes], random());
    const played = take(first, 4);

    const resumed = new ContentProgramShuffleIterator(
      [...episodes],
      random(99),
      first.snapshot(),
    );
    const rest = take(resumed, 6);
    expect(new Set([...played, ...rest])).toEqual(new Set(ids(episodes)));

    // The next pass covers the whole show again.
    expect(new Set(take(resumed, 10))).toEqual(new Set(ids(episodes)));
  });

  test('new programs join the pass and deleted ones drop out', () => {
    const episodes = fixtureEpisodes('show', 6, oneHour);
    const resumed = new ContentProgramShuffleIterator(
      [...episodes.slice(1), ...fixtureEpisodes('new', 1, oneHour)],
      random(),
      { type: 'shuffle', playedIds: ['show-ep1', 'show-ep2', 'show-ep3'] },
    );
    expect(new Set(take(resumed, 4))).toEqual(
      new Set(['show-ep4', 'show-ep5', 'show-ep6', 'new-ep1']),
    );
  });

  test('a finished pass leaves no state', () => {
    const iterator = new ContentProgramShuffleIterator(
      fixtureEpisodes('show', 3, oneHour),
      random(),
    );
    take(iterator, 3);
    expect(iterator.snapshot()).toBeUndefined();
  });
});

function showSlot(
  n: number,
  order: 'next' | 'shuffle' | 'ordered_shuffle',
  extra: Partial<TimeSlot> = {},
): TimeSlot {
  return {
    id: fixtureSlotId(n),
    startTime: 0,
    type: 'show',
    showId: 'show',
    order,
    direction: 'asc',
    seasonFilter: [],
    seasonExcludeFilter: [],
    ...extra,
  } as TimeSlot;
}

function daySchedule(slots: TimeSlot[]): TimeSlotSchedule {
  return {
    type: 'time',
    flexPreference: 'end',
    maxDays: 365,
    padMs: 1,
    period: 'day',
    latenessMs: 0,
    overflow: { type: 'duration', maxMs: 0 },
    timeZoneOffset: 0,
    slots,
  };
}

// Builds two consecutive day cycles. 24 hour-long episodes air per day.
async function twoTimeSlotCycles(
  slots: TimeSlot[],
  episodeCount: number,
  seed = [42],
) {
  const cycle1 = await scheduleTimeSlots(
    daySchedule(slots),
    fixtureEpisodes('show', episodeCount, oneHour),
    seed,
    0,
    day1,
    { endTime: day1.add(1, 'day') },
  );
  const cycle2 = await scheduleTimeSlots(
    daySchedule(slots),
    fixtureEpisodes('show', episodeCount, oneHour),
    seed,
    cycle1.discardCount,
    day1.add(1, 'day'),
    { endTime: day1.add(2, 'day'), iteratorState: cycle1.iteratorState },
  );
  return { cycle1, cycle2 };
}

describe('time slot cycles', () => {
  test('a cycle ends at its end time, not at maxDays', async () => {
    const { cycle1 } = await twoTimeSlotCycles([showSlot(1, 'next')], 30);
    const total = cycle1.lineup.reduce((sum, p) => sum + p.duration, 0);
    expect(total).toBe(oneDay);
  });

  test('an ordered show continues across cycles', async () => {
    const { cycle1, cycle2 } = await twoTimeSlotCycles(
      [showSlot(1, 'next')],
      30,
    );
    const all = ids(fixtureEpisodes('show', 30, oneHour));
    expect(contentIds(cycle1.lineup)).toEqual(all.slice(0, 24));
    expect(contentIds(cycle2.lineup).slice(0, 8)).toEqual([
      ...all.slice(24),
      ...all.slice(0, 2),
    ]);
  });

  test('a shuffled show finishes its pass before repeating', async () => {
    const { cycle1, cycle2 } = await twoTimeSlotCycles(
      [showSlot(1, 'shuffle')],
      30,
    );
    const all = ids(fixtureEpisodes('show', 30, oneHour));
    const firstPass = [
      ...contentIds(cycle1.lineup),
      ...contentIds(cycle2.lineup).slice(0, 6),
    ];
    expect(new Set(firstPass)).toEqual(new Set(all));
  });

  test('ordered_shuffle keeps its place across cycles', async () => {
    const { cycle1, cycle2 } = await twoTimeSlotCycles(
      [showSlot(1, 'ordered_shuffle')],
      30,
    );
    const all = ids(fixtureEpisodes('show', 30, oneHour));
    const last = contentIds(cycle1.lineup).at(-1) ?? '';
    const next = all[(all.indexOf(last) + 1) % all.length];
    expect(contentIds(cycle2.lineup)[0]).toBe(next);
  });

  test('a linked group continues across cycles', async () => {
    const group = '00000000-0000-4000-8000-0000000000a2';
    const slots = [
      showSlot(1, 'next', { iterationGroup: group, linkMode: 'continue' }),
      showSlot(2, 'next', {
        startTime: 12 * oneHour,
        iterationGroup: group,
        linkMode: 'continue',
      }),
    ];
    const { cycle1, cycle2 } = await twoTimeSlotCycles(slots, 30);
    const all = ids(fixtureEpisodes('show', 30, oneHour));
    expect(contentIds(cycle1.lineup)).toEqual(all.slice(0, 24));
    expect(contentIds(cycle2.lineup)[0]).toBe(all[24]);
  });

  test('the same seed and state build the same cycles', async () => {
    const slots = [showSlot(1, 'shuffle')];
    const first = await twoTimeSlotCycles(slots, 30);
    const second = await twoTimeSlotCycles(slots, 30);
    expect(second.cycle2.lineup).toEqual(first.cycle2.lineup);
    expect(second.cycle2.iteratorState).toEqual(first.cycle2.iteratorState);
  });
});

describe('random slot cycles', () => {
  const schedule = (): RandomSlotSchedule => ({
    type: 'random',
    flexPreference: 'end',
    maxDays: 365,
    padMs: 1,
    padStyle: 'slot',
    randomDistribution: 'none',
    lockWeights: false,
    slots: [
      {
        id: fixtureSlotId(1),
        type: 'show',
        showId: 'a',
        order: 'next',
        direction: 'asc',
        seasonFilter: [],
        seasonExcludeFilter: [],
        weight: 1,
        cooldownMs: 0,
        durationSpec: { type: 'dynamic', programCount: 1 },
      },
      {
        id: fixtureSlotId(2),
        type: 'show',
        showId: 'b',
        order: 'next',
        direction: 'asc',
        seasonFilter: [],
        seasonExcludeFilter: [],
        weight: 1,
        cooldownMs: 0,
        durationSpec: { type: 'dynamic', programCount: 1 },
      },
    ],
  });
  const programs = () => [
    ...fixtureEpisodes('a', 40, oneHour),
    ...fixtureEpisodes('b', 40, oneHour),
  ];

  test('sequential slots and ordered shows continue across cycles', () => {
    // 25 hours: slot a airs 13 times and slot b 12 times, so b is next.
    const end1 = day1.add(25, 'hour');
    const cycle1 = new RandomSlotScheduler(schedule()).generateSchedule(
      programs(),
      [42],
      0,
      day1,
      { endTime: end1 },
    );
    expect(contentIds(cycle1.lineup).at(-1)).toBe('a-ep13');

    const cycle2 = new RandomSlotScheduler(schedule()).generateSchedule(
      programs(),
      [42],
      cycle1.discardCount,
      end1,
      { endTime: end1.add(4, 'hour'), iteratorState: cycle1.iteratorState },
    );
    expect(contentIds(cycle2.lineup)).toEqual([
      'b-ep13',
      'a-ep14',
      'b-ep14',
      'a-ep15',
    ]);
  });
});

describe('worker schemas', () => {
  const iteratorState = {
    iterators: { 'slot:0': { type: 'shuffle', playedIds: ['x'] } },
    nextSlotIndex: 1,
  } as const;

  test('requests keep the cycle fields', () => {
    const parsed = WorkerRequest.parse({
      requestId: '00000000-0000-4000-8000-000000000001',
      type: 'time-slots',
      request: {
        type: 'channel',
        channelId: 'c',
        schedule: daySchedule([showSlot(1, 'next')]),
        endTime: 123,
        iteratorState,
      },
    });
    expect(parsed.type === 'time-slots' && parsed.request).toMatchObject({
      endTime: 123,
      iteratorState,
    });
  });

  test('replies keep the iterator state', () => {
    const parsed = WorkerSuccessReply.parse({
      type: 'success',
      requestId: 'r',
      data: {
        type: 'schedule-slots',
        result: {
          startTime: 1,
          lineup: [],
          seed: [1],
          discardCount: 0,
          iteratorState,
        },
      },
    });
    expect(parsed.data).toMatchObject({ result: { iteratorState } });
  });
});
