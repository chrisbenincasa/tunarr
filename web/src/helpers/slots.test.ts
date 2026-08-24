import type { BaseSlot } from '@tunarr/types/api';
import { describe, expect, test } from 'vitest';
import {
  makeContentProgram,
  makeEpisode,
  makeMovie,
  makeShowGrouping,
} from '../test/programFixtures.ts';
import { averageProgramDurationMs } from './slots.ts';

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

const flexSlot: BaseSlot = { type: 'flex' };

const movieProgram = (durationMs: number, uuid: string) =>
  makeContentProgram(makeMovie({ uuid }), durationMs);

const episodeProgram = (durationMs: number, uuid: string, showId: string) =>
  makeContentProgram(
    makeEpisode({ uuid, show: makeShowGrouping(showId) }),
    durationMs,
  );

describe('averageProgramDurationMs', () => {
  describe('movie slots', () => {
    test('averages the movies in the pool', () => {
      const programs = [
        movieProgram(90 * OneMinute, 'a'),
        movieProgram(110 * OneMinute, 'b'),
      ];

      expect(averageProgramDurationMs(movieSlot, programs)).toBe(
        100 * OneMinute,
      );
    });

    test('ignores episodes when averaging a movie slot', () => {
      const programs = [
        movieProgram(90 * OneMinute, 'a'),
        episodeProgram(20 * OneMinute, 'b', 'show-1'),
      ];

      expect(averageProgramDurationMs(movieSlot, programs)).toBe(
        90 * OneMinute,
      );
    });

    test('returns undefined rather than NaN when there are no movies', () => {
      expect(averageProgramDurationMs(movieSlot, [])).toBeUndefined();
      expect(
        averageProgramDurationMs(movieSlot, [
          episodeProgram(20 * OneMinute, 'b', 'show-1'),
        ]),
      ).toBeUndefined();
    });

    test('rounds to a whole millisecond', () => {
      const programs = [
        movieProgram(1000, 'a'),
        movieProgram(1001, 'b'),
        movieProgram(1001, 'c'),
      ];

      expect(averageProgramDurationMs(movieSlot, programs)).toBe(1001);
    });
  });

  describe('show slots', () => {
    test('averages only the episodes of the slots own show', () => {
      const programs = [
        episodeProgram(20 * OneMinute, 'a', 'show-1'),
        episodeProgram(40 * OneMinute, 'b', 'show-1'),
        episodeProgram(90 * OneMinute, 'c', 'show-2'),
        movieProgram(120 * OneMinute, 'd'),
      ];

      expect(averageProgramDurationMs(showSlot('show-1'), programs)).toBe(
        30 * OneMinute,
      );
    });

    test('returns undefined when the show has no episodes in the pool', () => {
      expect(
        averageProgramDurationMs(showSlot('show-3'), [
          episodeProgram(20 * OneMinute, 'a', 'show-1'),
        ]),
      ).toBeUndefined();
    });
  });

  test('returns undefined for a slot type with no fixed pool', () => {
    expect(
      averageProgramDurationMs(flexSlot, [movieProgram(90 * OneMinute, 'a')]),
    ).toBeUndefined();
  });
});
