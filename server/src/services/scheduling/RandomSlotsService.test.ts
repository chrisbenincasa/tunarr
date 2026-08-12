import { randomUUID } from 'node:crypto';
import dayjs from 'dayjs';
import { MersenneTwister19937, Random } from 'random-js';
import { describe, expect, test } from 'vitest';
import { createFakeProgramOrm } from '../../testing/fakes/entityCreators.ts';
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
