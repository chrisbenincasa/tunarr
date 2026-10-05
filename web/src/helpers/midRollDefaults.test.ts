import type { BaseSlot } from '@tunarr/types/api';
import { describe, expect, test } from 'vitest';
import {
  makeContentProgram,
  makeEpisode,
  makeMovie,
  makeShowGrouping,
} from '../test/programFixtures.ts';
import {
  deriveMidRollDefaults,
  FallbackMidRollDefaults,
} from './midRollDefaults.ts';

const OneMinute = 60_000;

const movieSlot: BaseSlot = {
  type: 'movie',
  id: 'slot-movie',
  order: 'shuffle',
  direction: 'asc',
};

const showSlot = (showId: string): BaseSlot => ({
  type: 'show',
  id: `slot-show-${showId}`,
  showId,
  order: 'next',
  direction: 'asc',
  seasonFilter: [],
  seasonExcludeFilter: [],
});

const smartCollectionSlot: BaseSlot = {
  type: 'smart-collection',
  id: 'slot-collection',
  smartCollectionId: '8e2cbfd8-9a0e-4a4e-9a4e-8f2f4e5f6a7b',
  order: 'shuffle',
  direction: 'asc',
};

const movieProgram = (durationMs: number, uuid: string) =>
  makeContentProgram(makeMovie({ uuid }), durationMs);

const episodeProgram = (durationMs: number, uuid: string, showId: string) =>
  makeContentProgram(
    makeEpisode({ uuid, show: makeShowGrouping(showId) }),
    durationMs,
  );

describe('deriveMidRollDefaults', () => {
  test('fits an hour-long drama slot', () => {
    // The durations that started this: ~42 minute episodes were skipped
    // entirely by the old 60 minute minimum.
    const programs = [
      episodeProgram(41.4 * OneMinute, 'a', 'show-1'),
      episodeProgram(42.5 * OneMinute, 'b', 'show-1'),
      episodeProgram(43.7 * OneMinute, 'c', 'show-1'),
    ];

    const config = deriveMidRollDefaults(showSlot('show-1'), programs);

    expect(config.minProgramDurationMs).toBe(40 * OneMinute);
    expect(config.breakRule).toEqual({
      type: 'fixed_interval',
      intervalMs: 15 * OneMinute,
    });
    expect(config.intervalMs).toBe(15 * OneMinute);
  });

  test('never excludes the shortest program in the pool', () => {
    const programs = [
      episodeProgram(22 * OneMinute, 'a', 'show-1'),
      episodeProgram(44 * OneMinute, 'b', 'show-1'),
      episodeProgram(46 * OneMinute, 'c', 'show-1'),
    ];

    const config = deriveMidRollDefaults(showSlot('show-1'), programs);

    expect(config.minProgramDurationMs).toBeLessThanOrEqual(22 * OneMinute);
  });

  test('caps the interval for feature-length movies', () => {
    const programs = [
      movieProgram(100 * OneMinute, 'a'),
      movieProgram(120 * OneMinute, 'b'),
      movieProgram(180 * OneMinute, 'c'),
    ];

    const config = deriveMidRollDefaults(movieSlot, programs);

    expect(config.intervalMs).toBe(30 * OneMinute);
    expect(config.minProgramDurationMs).toBe(100 * OneMinute);
  });

  test('keeps the interval usable for very short programs', () => {
    const programs = [
      episodeProgram(6 * OneMinute, 'a', 'show-1'),
      episodeProgram(8 * OneMinute, 'b', 'show-1'),
    ];

    const config = deriveMidRollDefaults(showSlot('show-1'), programs);

    expect(config.intervalMs).toBe(5 * OneMinute);
    expect(config.minProgramDurationMs).toBe(5 * OneMinute);
  });

  test('ignores programs the slot would not play', () => {
    const programs = [
      episodeProgram(20 * OneMinute, 'a', 'other-show'),
      movieProgram(120 * OneMinute, 'b'),
      episodeProgram(45 * OneMinute, 'c', 'show-1'),
    ];

    const config = deriveMidRollDefaults(showSlot('show-1'), programs);

    expect(config.minProgramDurationMs).toBe(45 * OneMinute);
    expect(config.intervalMs).toBe(15 * OneMinute);
  });

  test('falls back when the slot pool cannot be measured', () => {
    expect(
      deriveMidRollDefaults(smartCollectionSlot, [
        movieProgram(120 * OneMinute, 'a'),
      ]),
    ).toEqual(FallbackMidRollDefaults);
  });

  test('falls back when the channel has no programs loaded', () => {
    expect(deriveMidRollDefaults(showSlot('show-1'), [])).toEqual(
      FallbackMidRollDefaults,
    );
  });
});
