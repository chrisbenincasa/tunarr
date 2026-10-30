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
      expect(averageProgramDurationMs(showSlot('show-1'), [])).toBeUndefined();
      expect(
        averageProgramDurationMs(showSlot('show-3'), [
          episodeProgram(20 * OneMinute, 'a', 'show-1'),
        ]),
      ).toBeUndefined();
    });

    test('rounds to a whole millisecond', () => {
      const programs = [
        episodeProgram(1000, 'a', 'show-1'),
        episodeProgram(1001, 'b', 'show-1'),
        episodeProgram(1001, 'c', 'show-1'),
      ];

      expect(averageProgramDurationMs(showSlot('show-1'), programs)).toBe(1001);
    });
  });

  test('returns undefined for a slot type with no fixed pool', () => {
    expect(
      averageProgramDurationMs(flexSlot, [movieProgram(90 * OneMinute, 'a')]),
    ).toBeUndefined();
  });
});
