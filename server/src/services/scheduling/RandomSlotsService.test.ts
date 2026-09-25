import type {
  RandomSlot,
  RandomSlotDurationSpec,
  RandomSlotSchedule,
  SlotScheduleResult,
} from '@tunarr/types/api';
import { sumBy } from 'lodash-es';
import { randomUUID } from 'node:crypto';
import dayjs from 'dayjs';
import { MersenneTwister19937, Random } from 'random-js';
import { describe, expect, test } from 'vitest';
import { createFakeProgramOrm } from '../../testing/fakes/entityCreators.ts';
import { ScheduleValidationError } from '../../types/errors.ts';
import { RandomSlotScheduler } from './RandomSlotsService.ts';
import {
  createFillerIterators,
  createProgramMap,
  getFillerIteratorsForSlot,
} from './slotSchedulerUtil.ts';
import type { SlotSchedulerProgram } from './slotSchedulerUtil.ts';

describe('randomSlotsService', () => {
  test('basic', async () => {
    new RandomSlotScheduler({
      type: 'random',
      flexPreference: 'distribute',
      maxDays: 365,
      padMs: 30 * 60 * 1000,
      padStyle: 'slot',
      randomDistribution: 'uniform',
      lockWeights: false,
      slots: [
        {
          weight: 37.5,
          cooldownMs: 0.0,
          durationSpec: {
            type: 'fixed',
            durationMs: +dayjs.duration({ minutes: 30 }),
          },
          type: 'show',
          showId: 'test.1',
          order: 'next',
          direction: 'asc',
        },
        {
          weight: 25.0,
          cooldownMs: 0.0,
          durationSpec: {
            type: 'fixed',
            durationMs: +dayjs.duration({ hours: 3 }),
          },
          type: 'movie',
          order: 'next',
          direction: 'asc',
        },
        {
          weight: 37.5,
          cooldownMs: 0.0,
          durationSpec: {
            type: 'fixed',
            durationMs: +dayjs.duration({ minutes: 30 }),
          },
          type: 'show',
          showId: 'test.2',
          order: 'next',
          direction: 'asc',
        },
      ],
    });
  });

  test('linked random slots get independent filler iterators via fork', () => {
    const fillerListId = randomUUID();
    const groupId = randomUUID();

    // Create 15 filler programs assigned to the filler list
    const fillerPrograms: SlotSchedulerProgram[] = Array.from(
      { length: 15 },
      (_, i) => ({
        ...createFakeProgramOrm({
          uuid: `filler-${i}`,
          title: `Filler ${i}`,
          type: 'movie',
          duration: 2 * 60 * 1000, // 2 min each
        }),
        parentFillerLists: [fillerListId],
        parentCustomShows: [],
        parentSmartCollections: [],
      }),
    );

    // Two linked random slots that share an iterationGroup
    const slotA = {
      id: randomUUID(),
      weight: 50,
      cooldownMs: 0,
      durationSpec: { type: 'fixed' as const, durationMs: 30 * 60 * 1000 },
      type: 'show' as const,
      showId: 'show1',
      order: 'next' as const,
      direction: 'asc' as const,
      seasonFilter: [] as number[],
      iterationGroup: groupId,
      linkMode: 'rerun' as const,
      filler: [
        {
          types: ['tail' as const],
          fillerListId,
          fillerOrder: 'shuffle_prefer_short' as const,
        },
      ],
    };

    const slotB = {
      id: randomUUID(),
      weight: 50,
      cooldownMs: 0,
      durationSpec: { type: 'fixed' as const, durationMs: 30 * 60 * 1000 },
      type: 'show' as const,
      showId: 'show1',
      order: 'next' as const,
      direction: 'asc' as const,
      seasonFilter: [] as number[],
      iterationGroup: groupId,
      linkMode: 'rerun' as const,
      filler: [
        {
          types: ['tail' as const],
          fillerListId,
          fillerOrder: 'shuffle_prefer_short' as const,
        },
      ],
    };

    const mt = MersenneTwister19937.seed(42);
    const random = new Random(mt);
    const programMap = createProgramMap(fillerPrograms);

    // Create the shared filler iterator map
    const fillerMap = createFillerIterators([slotA, slotB], programMap, random);

    // Track seen groups so the second call triggers fork
    const seenLinkGroups = new Set<string>();

    // First slot gets the original iterator
    const fillersSlotA = getFillerIteratorsForSlot(
      slotA,
      fillerMap,
      seenLinkGroups,
    );

    // Second slot with same iterationGroup gets a forked copy
    const fillersSlotB = getFillerIteratorsForSlot(
      slotB,
      fillerMap,
      seenLinkGroups,
    );

    expect(fillersSlotA[fillerListId]).toBeDefined();
    expect(fillersSlotB[fillerListId]).toBeDefined();

    // The iterators should be different objects (forked)
    expect(fillersSlotA[fillerListId]).not.toBe(fillersSlotB[fillerListId]);

    // Draw 8 items from each and compare sequences
    const state = { slotDuration: 30 * 60 * 1000, timeCursor: 0 };
    const seqA: string[] = [];
    const seqB: string[] = [];

    for (let i = 0; i < 8; i++) {
      const itemA = fillersSlotA[fillerListId].current(state);
      if (itemA && 'id' in itemA) {
        seqA.push(itemA.id ?? '');
      }
      fillersSlotA[fillerListId].next();

      const itemB = fillersSlotB[fillerListId].current(state);
      if (itemB && 'id' in itemB) {
        seqB.push(itemB.id ?? '');
      }
      fillersSlotB[fillerListId].next();
    }

    expect(seqA.length).toBe(8);
    expect(seqB.length).toBe(8);

    // The sequences should differ because fork() creates an independent PRNG copy
    // that diverges from the original after fork point
    expect(seqA).not.toEqual(seqB);
  });
});

describe('random slot filler budgeting', () => {
  const oneMin = 60 * 1000;
  const slotMs = 30 * oneMin;
  const midnight = dayjs('2024-01-01T00:00:00.000Z');

  const makeEpisodes = (
    showId: string,
    count: number,
    durationMs: number,
  ): SlotSchedulerProgram[] =>
    Array.from({ length: count }, (_, i) => ({
      ...createFakeProgramOrm({
        uuid: `${showId}-ep${i + 1}`,
        title: `${showId} Episode ${i + 1}`,
        type: 'episode',
        duration: durationMs,
        episode: i + 1,
        tvShowUuid: showId,
        show: { uuid: showId },
      }),
      parentFillerLists: [],
      parentCustomShows: [],
      parentSmartCollections: [],
    }));

  const makeFillers = (
    fillerListId: string,
    count: number,
    durationMs: number,
  ): SlotSchedulerProgram[] =>
    Array.from({ length: count }, (_, i) => ({
      ...createFakeProgramOrm({
        uuid: `bumper-${i}`,
        title: `Bumper ${i}`,
        type: 'movie',
        duration: durationMs,
      }),
      parentFillerLists: [fillerListId],
      parentCustomShows: [],
      parentSmartCollections: [],
    }));

  test('post-roll filler on a later program cannot overflow a fixed duration slot', () => {
    const fillerListId = randomUUID();

    const scheduler = new RandomSlotScheduler({
      type: 'random',
      flexPreference: 'end',
      maxDays: 1,
      padMs: oneMin,
      padStyle: 'episode',
      randomDistribution: 'uniform',
      lockWeights: false,
      slots: [
        {
          weight: 100,
          cooldownMs: 0,
          durationSpec: { type: 'fixed', durationMs: slotMs },
          type: 'show',
          showId: 'show1',
          order: 'next',
          direction: 'asc',
          seasonFilter: [],
          filler: [
            {
              types: ['post'],
              fillerListId,
              fillerOrder: 'shuffle_prefer_short',
            },
          ],
        },
      ],
    });

    const result = scheduler.generateSchedule(
      [
        ...makeEpisodes('show1', 12, 5 * oneMin),
        // Only fits at the top of a slot; budgeting it against the whole slot
        // instead of the remaining time overruns the slot's duration.
        ...makeFillers(fillerListId, 3, 12 * oneMin),
      ],
      [42, 99],
      undefined,
      midnight,
    );

    // A 30 minute slot holding 5 minute episodes can afford exactly one
    // 12 minute post-roll: after the first episode and its bumper there are
    // 13 minutes left, which is not enough for a second one. Budgeting the
    // bumper against the whole slot rather than the time actually left over
    // buys a second one and overruns the slot.
    const shape = result.lineup
      .slice(0, 6)
      .map((item) =>
        item.type === 'content' && 'id' in item
          ? `content:${item.id}`
          : `${item.type}:${item.duration / oneMin}min`,
      );

    expect(shape).toEqual([
      'content:show1-ep1',
      'filler:12min',
      'content:show1-ep2',
      'content:show1-ep3',
      'content:show1-ep4',
      'filler:12min',
    ]);
  });
});

describe('random slot cooldown', () => {
  const oneMin = 60 * 1000;
  const midnight = dayjs('2024-01-01T00:00:00.000Z');

  const makeEpisodes = (
    showId: string,
    count: number,
    durationMs: number,
  ): SlotSchedulerProgram[] =>
    Array.from({ length: count }, (_, i) => ({
      ...createFakeProgramOrm({
        uuid: `${showId}-ep${i + 1}`,
        title: `${showId} Episode ${i + 1}`,
        type: 'episode',
        duration: durationMs,
        episode: i + 1,
        tvShowUuid: showId,
        show: { uuid: showId },
      }),
      parentFillerLists: [],
      parentCustomShows: [],
      parentSmartCollections: [],
    }));

  test('a slot is not scheduled again within its cooldown', () => {
    const slotMs = 30 * oneMin;
    const cooldownMs = 2 * 60 * oneMin;

    const scheduler = new RandomSlotScheduler({
      type: 'random',
      flexPreference: 'end',
      maxDays: 1,
      padMs: oneMin,
      padStyle: 'episode',
      randomDistribution: 'uniform',
      lockWeights: false,
      slots: [
        {
          weight: 100,
          cooldownMs,
          durationSpec: { type: 'fixed', durationMs: slotMs },
          type: 'show',
          showId: 'show1',
          order: 'next',
          direction: 'asc',
          seasonFilter: [],
        },
      ],
    });

    const result = scheduler.generateSchedule(
      makeEpisodes('show1', 24, slotMs),
      [42, 99],
      undefined,
      midnight,
    );

    // Walk the lineup and record the offset at which each content program
    // starts. With a single slot, every content start is that slot playing.
    let offset = 0;
    const contentStarts: number[] = [];
    for (const item of result.lineup) {
      if (item.type === 'content') {
        contentStarts.push(offset);
      }
      offset += item.duration;
    }

    expect(contentStarts.length).toBeGreaterThan(1);
    for (let i = 1; i < contentStarts.length; i++) {
      expect(contentStarts[i]! - contentStarts[i - 1]!).toBeGreaterThanOrEqual(
        cooldownMs,
      );
    }
  });
  test('a zero cooldown schedules back to back, as before', () => {
    const slotMs = 30 * oneMin;

    const scheduler = new RandomSlotScheduler({
      type: 'random',
      flexPreference: 'end',
      maxDays: 1,
      padMs: oneMin,
      padStyle: 'episode',
      randomDistribution: 'uniform',
      lockWeights: false,
      slots: [
        {
          weight: 100,
          cooldownMs: 0,
          durationSpec: { type: 'fixed', durationMs: slotMs },
          type: 'show',
          showId: 'show1',
          order: 'next',
          direction: 'asc',
          seasonFilter: [],
        },
      ],
    });

    const result = scheduler.generateSchedule(
      makeEpisodes('show1', 24, slotMs),
      [42, 99],
      undefined,
      midnight,
    );

    // Every existing schedule in the wild uses cooldownMs: 0, so honouring
    // cooldown must not start inserting flex into any of them.
    expect(result.lineup.slice(0, 4).map((item) => item.type)).toEqual([
      'content',
      'content',
      'content',
      'content',
    ]);
  });
});

describe('random slot scheduler termination', () => {
  const oneMin = 60 * 1000;
  const oneHour = 60 * oneMin;
  const oneDay = 24 * oneHour;
  const midnight = dayjs('2024-01-01T00:00:00.000Z');
  const distributions = ['none', 'uniform', 'weighted'] as const;

  const makeMovies = (
    prefix: string,
    count: number,
    durationMs: number,
  ): SlotSchedulerProgram[] =>
    Array.from({ length: count }, (_, i) => ({
      ...createFakeProgramOrm({
        uuid: `${prefix}-${i + 1}`,
        title: `${prefix} ${i + 1}`,
        type: 'movie',
        duration: durationMs,
        originalAirDate: `2000-01-${String(i + 1).padStart(2, '0')}`,
      }),
      parentFillerLists: [],
      parentCustomShows: [],
      parentSmartCollections: [],
    }));

  const makeEpisodes = (showId: string, count: number, durationMs: number) =>
    Array.from({ length: count }, (_, i) => ({
      ...createFakeProgramOrm({
        uuid: `${showId}-ep${i + 1}`,
        title: `${showId} Episode ${i + 1}`,
        type: 'episode',
        duration: durationMs,
        episode: i + 1,
        tvShowUuid: showId,
        show: { uuid: showId },
      }),
      parentFillerLists: [],
      parentCustomShows: [],
      parentSmartCollections: [],
    })) satisfies SlotSchedulerProgram[];

  const emptyCustomShowSlot = (
    durationSpec: RandomSlotDurationSpec = { type: 'dynamic', programCount: 1 },
  ): RandomSlot => ({
    id: randomUUID(),
    type: 'custom-show',
    customShowId: randomUUID(),
    order: 'next',
    direction: 'asc',
    weight: 1,
    cooldownMs: 0,
    durationSpec,
  });

  const movieSlot = (
    durationSpec: RandomSlotDurationSpec,
    cooldownMs = 0,
  ): RandomSlot => ({
    id: randomUUID(),
    type: 'movie',
    order: 'next',
    direction: 'asc',
    weight: 1,
    cooldownMs,
    durationSpec,
  });

  const schedule = (
    slots: RandomSlot[],
    overrides: Partial<RandomSlotSchedule> = {},
  ): RandomSlotSchedule => ({
    type: 'random',
    flexPreference: 'end',
    maxDays: 0,
    padMs: 1,
    padStyle: 'slot',
    randomDistribution: 'none',
    lockWeights: false,
    slots,
    ...overrides,
  });

  const totalDuration = (result: SlotScheduleResult) =>
    sumBy(result.lineup, (item) => item.duration);

  const contentIds = (result: SlotScheduleResult) =>
    result.lineup.flatMap((item) =>
      item.type === 'content' && 'id' in item && item.id ? [item.id] : [],
    );

  test.each(distributions)(
    'an empty dynamic custom show fills the window with flex (%s)',
    (randomDistribution) => {
      const result = new RandomSlotScheduler(
        schedule([emptyCustomShowSlot()], { randomDistribution }),
      ).generateSchedule([], [42], 0, midnight);

      expect(result.lineup.every((item) => item.type === 'flex')).toBe(true);
      expect(totalDuration(result)).toBe(oneDay);
    },
  );

  test.each(distributions)(
    'an empty dynamic slot does not block a healthy slot (%s)',
    (randomDistribution) => {
      const result = new RandomSlotScheduler(
        schedule(
          [
            emptyCustomShowSlot(),
            movieSlot({ type: 'dynamic', programCount: 1 }),
          ],
          { randomDistribution },
        ),
      ).generateSchedule(makeMovies('movie', 10, oneHour), [42], 0, midnight);

      expect(contentIds(result)).toHaveLength(24);
      expect(totalDuration(result)).toBe(oneDay);
    },
  );

  test('sequential order skips an empty slot without reordering the rest', () => {
    const result = new RandomSlotScheduler(
      schedule([
        movieSlot({ type: 'dynamic', programCount: 1 }),
        emptyCustomShowSlot(),
        movieSlot({ type: 'dynamic', programCount: 1 }),
      ]),
    ).generateSchedule(makeMovies('movie', 3, oneHour), [42], 0, midnight);

    // Both movie slots share content but hold independent iterators.
    expect(contentIds(result).slice(0, 4)).toEqual([
      'movie-1',
      'movie-1',
      'movie-2',
      'movie-2',
    ]);
  });

  test('an empty dynamic slot waits out a healthy slot cooldown', () => {
    const cooldownMs = 2 * oneHour;
    const result = new RandomSlotScheduler(
      schedule(
        [
          emptyCustomShowSlot(),
          movieSlot({ type: 'fixed', durationMs: 30 * oneMin }, cooldownMs),
        ],
        { randomDistribution: 'uniform', padMs: oneMin, padStyle: 'episode' },
      ),
    ).generateSchedule(makeMovies('movie', 5, 30 * oneMin), [42], 0, midnight);

    let offset = 0;
    const contentStarts: number[] = [];
    for (const item of result.lineup) {
      if (item.type === 'content') {
        contentStarts.push(offset);
      }
      offset += item.duration;
    }

    expect(contentStarts).toHaveLength(12);
    for (let i = 1; i < contentStarts.length; i++) {
      expect(
        (contentStarts[i] ?? 0) - (contentStarts[i - 1] ?? 0),
      ).toBeGreaterThanOrEqual(cooldownMs);
    }
    expect(totalDuration(result)).toBe(oneDay);
  });

  test('a rerun slot with nothing to replay yet defers to its linked slot', () => {
    const iterationGroup = randomUUID();
    const linked = (linkMode: 'continue' | 'rerun'): RandomSlot => ({
      id: randomUUID(),
      type: 'show',
      showId: 'show1',
      order: 'next',
      direction: 'asc',
      seasonFilter: [],
      weight: 1,
      cooldownMs: 0,
      durationSpec: { type: 'dynamic', programCount: 1 },
      iterationGroup,
      linkMode,
      rerunOverflow: 'flex',
    });

    const result = new RandomSlotScheduler(
      schedule([linked('rerun'), linked('continue')]),
    ).generateSchedule(makeEpisodes('show1', 6, oneHour), [42], 0, midnight);

    expect(contentIds(result).slice(0, 4)).toEqual([
      'show1-ep1',
      'show1-ep1',
      'show1-ep2',
      'show1-ep2',
    ]);
  });

  test('a fixed slot with no content covers its duration with flex', () => {
    const result = new RandomSlotScheduler(
      schedule([emptyCustomShowSlot({ type: 'fixed', durationMs: oneHour })], {
        randomDistribution: 'uniform',
      }),
    ).generateSchedule([], [42], 0, midnight);

    expect(result.lineup.every((item) => item.type === 'flex')).toBe(true);
    expect(totalDuration(result)).toBe(oneDay);
  });

  test.each(distributions)(
    'a schedule with no slots fills only the requested window (%s)',
    (randomDistribution) => {
      const result = new RandomSlotScheduler(
        schedule([], { randomDistribution, maxDays: 1 }),
      ).generateSchedule([], [42], 0, midnight);

      expect(result.lineup.every((item) => item.type === 'flex')).toBe(true);
      expect(totalDuration(result)).toBe(2 * oneDay);
    },
  );

  test.each([
    ['zero', { type: 'fixed', durationMs: 0 }],
    ['negative', { type: 'fixed', durationMs: -oneHour }],
    ['NaN', { type: 'fixed', durationMs: Number.NaN }],
    ['infinite', { type: 'fixed', durationMs: Number.POSITIVE_INFINITY }],
    ['zero count', { type: 'dynamic', programCount: 0 }],
    ['fractional count', { type: 'dynamic', programCount: 1.5 }],
  ] satisfies [string, RandomSlotDurationSpec][])(
    'rejects a %s slot duration before scheduling',
    (_label, durationSpec) => {
      const scheduler = new RandomSlotScheduler(
        schedule([movieSlot(durationSpec)]),
        { strictValidation: true },
      );

      expect(() =>
        scheduler.generateSchedule(
          makeMovies('movie', 2, oneHour),
          [42],
          0,
          midnight,
        ),
      ).toThrow(ScheduleValidationError);
    },
  );

  test.each([
    ['zero', { type: 'fixed', durationMs: 0 }],
    ['negative', { type: 'fixed', durationMs: -oneHour }],
    ['fractional count', { type: 'dynamic', programCount: 1.5 }],
  ] satisfies [string, RandomSlotDurationSpec][])(
    'regeneration tolerates a stored %s slot duration',
    (_label, durationSpec) => {
      const result = new RandomSlotScheduler(
        schedule([
          movieSlot(durationSpec),
          movieSlot({ type: 'dynamic', programCount: 1 }),
        ]),
      ).generateSchedule(makeMovies('movie', 4, oneHour), [42], 0, midnight);

      expect(contentIds(result).length).toBeGreaterThan(0);
      expect(totalDuration(result)).toBe(oneDay);
    },
  );

  test.each([
    ['fixed', { type: 'fixed', durationMs: oneHour }],
    ['dynamic', { type: 'dynamic', programCount: 2 }],
  ] satisfies [string, RandomSlotDurationSpec][])(
    'zero-duration content alone does not stall a %s slot',
    (_label, durationSpec) => {
      const result = new RandomSlotScheduler(
        schedule([movieSlot(durationSpec)]),
      ).generateSchedule(makeMovies('zero', 1, 0), [42], 0, midnight);

      expect(contentIds(result)).toEqual([]);
      expect(totalDuration(result)).toBe(oneDay);
    },
  );

  test.each([
    ['fixed', { type: 'fixed', durationMs: oneHour }],
    ['dynamic', { type: 'dynamic', programCount: 2 }],
  ] satisfies [string, RandomSlotDurationSpec][])(
    'zero-duration content mixed with valid content is skipped in a %s slot',
    (_label, durationSpec) => {
      const result = new RandomSlotScheduler(
        schedule([movieSlot(durationSpec)]),
      ).generateSchedule(
        [...makeMovies('zero', 2, 0), ...makeMovies('valid', 2, 20 * oneMin)],
        [42],
        0,
        midnight,
      );

      const ids = contentIds(result);
      expect(ids.length).toBeGreaterThan(0);
      expect(ids.every((id) => id.startsWith('valid-'))).toBe(true);
      expect(totalDuration(result)).toBeLessThanOrEqual(oneDay);
    },
  );
});
