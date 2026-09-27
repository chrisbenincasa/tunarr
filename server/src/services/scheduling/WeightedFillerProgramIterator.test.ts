import { randomUUID } from 'node:crypto';
import type { FillerProgrammingSlot } from '@tunarr/types/api';
import { MersenneTwister19937, Random } from 'random-js';
import { describe, expect, test } from 'vitest';
import { createFakeProgramOrm } from '../../testing/fakes/entityCreators.ts';
import type { WeightedProgram } from './ProgramIterator.ts';
import type { SlotSchedulerProgram } from './slotSchedulerUtil.ts';
import { WeightedFillerProgramIterator } from './WeightedFillerProgramIterator.ts';

function makeFillerPrograms(
  count: number,
  durationMs: number = 30_000,
): SlotSchedulerProgram[] {
  return Array.from(
    { length: count },
    (_, i) =>
      ({
        ...createFakeProgramOrm({
          uuid: `filler-${i}`,
          title: `Filler ${i}`,
          type: 'movie',
          duration: durationMs,
        }),
        parentFillerLists: [],
        parentCustomShows: [],
        parentSmartCollections: [],
      }) satisfies SlotSchedulerProgram,
  );
}

function makeSlotDef(
  overrides?: Partial<FillerProgrammingSlot>,
): FillerProgrammingSlot {
  return {
    id: randomUUID(),
    type: 'filler',
    fillerListId: randomUUID(),
    order: 'shuffle_prefer_short',
    durationWeighting: 'linear',
    decayFactor: 0.5,
    recoveryFactor: 0.05,
    ...overrides,
  };
}

function makeRandom(seed: number = 42): Random {
  return new Random(MersenneTwister19937.seed(seed));
}

describe('WeightedFillerProgramIterator', () => {
  describe('pre-roll filler depletion fix', () => {
    test('returns filler beyond the size of the list with cooldownMs: 0', () => {
      const programs = makeFillerPrograms(3, 15_000);
      const slotDef = makeSlotDef();
      const random = makeRandom();
      const iterator = new WeightedFillerProgramIterator(
        programs as never,
        slotDef,
        random,
        'pre',
      );

      // Pick more fillers than the list size. With cooldownMs: 0,
      // the hard dedup is disabled and weight decay drives variety.
      const picks: string[] = [];
      for (let i = 0; i < 10; i++) {
        const result = iterator.current({
          timeCursor: i * 1_000_000,
          slotDuration: 60_000,
          cooldownMs: 0,
        });
        expect(result).not.toBeNull();
        picks.push(result!.id);
        iterator.next();
      }

      // All 10 picks should have returned a filler program.
      expect(picks).toHaveLength(10);
      // We should see repeats — the list has only 3 items.
      const unique = new Set(picks);
      expect(unique.size).toBeLessThanOrEqual(3);
    });

    test('returns filler beyond the size of the list when timeCursor advances past cooldown', () => {
      const programs = makeFillerPrograms(3, 15_000);
      const slotDef = makeSlotDef();
      const random = makeRandom();
      const iterator = new WeightedFillerProgramIterator(
        programs as never,
        slotDef,
        random,
        'pre',
      );

      // With an advancing timeCursor that exceeds the default cooldown
      // (slotDuration), previously-seen programs become eligible again.
      const picks: string[] = [];
      for (let i = 0; i < 10; i++) {
        const result = iterator.current({
          timeCursor: i * 1_000_000,
          slotDuration: 60_000,
        });
        expect(result).not.toBeNull();
        picks.push(result!.id);
        iterator.next();
      }

      expect(picks).toHaveLength(10);
      const unique = new Set(picks);
      expect(unique.size).toBeLessThanOrEqual(3);
    });

    test('depletes when timeCursor is constant (same time window)', () => {
      const programs = makeFillerPrograms(3, 15_000);
      const slotDef = makeSlotDef();
      const random = makeRandom();
      const iterator = new WeightedFillerProgramIterator(
        programs as never,
        slotDef,
        random,
        'mid',
      );

      // With constant timeCursor, the lastSeen dedup should filter
      // out programs after they're picked, which is correct behavior
      // for mid-roll breaks within a single time window.
      const picks: string[] = [];
      for (let i = 0; i < 6; i++) {
        const result = iterator.current({
          timeCursor: 1_000_000,
          slotDuration: 60_000,
        });
        if (!result) break;
        picks.push(result.id);
        iterator.next();
      }

      // Should pick at most 3 (one per unique program) before depleting.
      expect(picks.length).toBeLessThanOrEqual(3);
      expect(new Set(picks).size).toBe(picks.length);
    });
  });

  describe('negative slotDuration handling', () => {
    test('returns filler when slotDuration is -1 (no duration constraint)', () => {
      const programs = makeFillerPrograms(5, 30_000);
      const slotDef = makeSlotDef();
      const random = makeRandom();
      const iterator = new WeightedFillerProgramIterator(
        programs as never,
        slotDef,
        random,
        'pre',
      );

      // With slotDuration = -1, all programs should be considered
      // regardless of their duration.
      const result = iterator.current({
        timeCursor: 1_000_000,
        slotDuration: -1,
      });

      expect(result).not.toBeNull();
      expect(result!.type).toBe('filler');
    });

    test('includes all programs when slotDuration is negative', () => {
      // Create programs with varying durations. Use shuffle_prefer_long
      // so the long program has significant weight and gets picked.
      const programs: SlotSchedulerProgram[] = [
        {
          ...createFakeProgramOrm({
            uuid: 'short',
            title: 'Short',
            type: 'movie',
            duration: 10_000,
          }),
          parentFillerLists: [],
          parentCustomShows: [],
          parentSmartCollections: [],
        },
        {
          ...createFakeProgramOrm({
            uuid: 'long',
            title: 'Long',
            type: 'movie',
            duration: 300_000,
          }),
          parentFillerLists: [],
          parentCustomShows: [],
          parentSmartCollections: [],
        },
      ];

      const slotDef = makeSlotDef({ order: 'shuffle_prefer_long' });
      const random = makeRandom();
      const iterator = new WeightedFillerProgramIterator(
        programs as never,
        slotDef,
        random,
        'pre',
      );

      // With slotDuration = -1, even the "long" program should be eligible.
      // Pick several times to verify both can appear.
      const ids = new Set<string>();
      for (let i = 0; i < 20; i++) {
        const result = iterator.current({
          timeCursor: i * 1_000_000,
          slotDuration: -1,
        });
        if (result) {
          ids.add(result.id);
          iterator.next();
        }
      }

      expect(ids.size).toBe(2);
    });

    test('previously only included programs shorter than slotDuration', () => {
      // Verify the positive slotDuration gating still works correctly.
      const programs: SlotSchedulerProgram[] = [
        {
          ...createFakeProgramOrm({
            uuid: 'fits',
            title: 'Fits',
            type: 'movie',
            duration: 10_000,
          }),
          parentFillerLists: [],
          parentCustomShows: [],
          parentSmartCollections: [],
        },
        {
          ...createFakeProgramOrm({
            uuid: 'too-long',
            title: 'Too Long',
            type: 'movie',
            duration: 300_000,
          }),
          parentFillerLists: [],
          parentCustomShows: [],
          parentSmartCollections: [],
        },
      ];

      const slotDef = makeSlotDef();
      const random = makeRandom();
      const iterator = new WeightedFillerProgramIterator(
        programs as never,
        slotDef,
        random,
        'pre',
      );

      // With slotDuration = 60_000, only the 10s program should be eligible.
      const ids = new Set<string>();
      for (let i = 0; i < 10; i++) {
        const result = iterator.current({
          timeCursor: i * 1_000_000,
          slotDuration: 60_000,
        });
        if (result) {
          ids.add(result.id);
          iterator.next();
        }
      }

      expect(ids).toContain('fits');
      expect(ids).not.toContain('too-long');
    });
  });

  describe('fork', () => {
    // The scheduler forks while building slots, before any program is picked,
    // so each test forks first and picks afterward.

    test('a fork skips programs the parent aired inside their cooldown', () => {
      const parent = new WeightedFillerProgramIterator(
        makeFillerPrograms(2, 15_000) as never,
        makeSlotDef(),
        makeRandom(),
        'pre',
      );
      const fork = parent.fork();
      const state = { timeCursor: 1_000_000, slotDuration: 60_000 };

      const fromParent = parent.current(state);
      const fromFork = fork.current(state);

      if (!fromParent || !fromFork) {
        throw new Error('expected both iterators to pick a program');
      }
      expect(fromFork.id).not.toBe(fromParent.id);
    });

    test('the parent skips programs the fork aired inside their cooldown', () => {
      const parent = new WeightedFillerProgramIterator(
        makeFillerPrograms(2, 15_000) as never,
        makeSlotDef(),
        makeRandom(),
        'pre',
      );
      const fork = parent.fork();
      const state = { timeCursor: 1_000_000, slotDuration: 60_000 };

      expect(fork.current(state)).not.toBeNull();
      expect(fork.current(state)).not.toBeNull();

      expect(parent.current(state)).toBeNull();
    });

    test('programs become eligible for both again once the cooldown passes', () => {
      const parent = new WeightedFillerProgramIterator(
        makeFillerPrograms(1, 15_000) as never,
        makeSlotDef(),
        makeRandom(),
        'pre',
      );
      const fork = parent.fork();

      const aired = parent.current({ timeCursor: 0, slotDuration: 60_000 });
      const later = fork.current({ timeCursor: 60_000, slotDuration: 60_000 });

      if (!aired || !later) {
        throw new Error('expected both iterators to pick a program');
      }
      expect(later.id).toBe(aired.id);
    });
  });

  describe('duration weighting', () => {
    const filler = (uuid: string, duration: number): SlotSchedulerProgram => ({
      ...createFakeProgramOrm({ uuid, title: uuid, type: 'movie', duration }),
      parentFillerLists: [],
      parentCustomShows: [],
      parentSmartCollections: [],
    });

    // Deliberately not ordered by duration. The iterator sorts its own
    // copy for the duration cutoff in current(), and every weight has to
    // stay attached to the program it was computed from.
    const programs = [
      filler('p60', 60_000),
      filler('p15', 15_000),
      filler('p120', 120_000),
      filler('p30', 30_000),
    ];

    function weightsByUuid(
      order: 'shuffle_prefer_short' | 'shuffle_prefer_long',
      durationWeighting: 'linear' | 'log',
    ): Map<string, number> {
      const iterator = new WeightedFillerProgramIterator(
        programs as never,
        makeSlotDef({ order, durationWeighting }),
        makeRandom(),
        'pre',
      );
      const weighted = (
        iterator as unknown as { weightedPrograms: WeightedProgram[] }
      ).weightedPrograms;
      return new Map(weighted.map((wp) => [wp.program.uuid, wp.currentWeight]));
    }

    test('prefer_short with linear weighting favors the shortest programs', () => {
      const weights = weightsByUuid('shuffle_prefer_short', 'linear');
      expect(weights.get('p15')).toBeCloseTo(0.4118, 4);
      expect(weights.get('p30')).toBeCloseTo(0.3529, 4);
      expect(weights.get('p60')).toBeCloseTo(0.2353, 4);
      expect(weights.get('p120')).toBeCloseTo(0, 4);
    });

    test('prefer_short with log weighting favors the shortest programs', () => {
      const weights = weightsByUuid('shuffle_prefer_short', 'log');
      expect(weights.get('p15')).toBeCloseTo(0.3925, 4);
      expect(weights.get('p30')).toBeCloseTo(0.2875, 4);
      expect(weights.get('p60')).toBeCloseTo(0.1962, 4);
      expect(weights.get('p120')).toBeCloseTo(0.1238, 4);
    });

    test('prefer_long with linear weighting favors the longest programs', () => {
      const weights = weightsByUuid('shuffle_prefer_long', 'linear');
      expect(weights.get('p15')).toBeCloseTo(0.0667, 4);
      expect(weights.get('p30')).toBeCloseTo(0.1333, 4);
      expect(weights.get('p60')).toBeCloseTo(0.2667, 4);
      expect(weights.get('p120')).toBeCloseTo(0.5333, 4);
    });

    test('prefer_long with log weighting favors the longest programs', () => {
      const weights = weightsByUuid('shuffle_prefer_long', 'log');
      expect(weights.get('p15')).toBeCloseTo(0.2256, 4);
      expect(weights.get('p30')).toBeCloseTo(0.2419, 4);
      expect(weights.get('p60')).toBeCloseTo(0.2581, 4);
      expect(weights.get('p120')).toBeCloseTo(0.2744, 4);
    });
  });
});
