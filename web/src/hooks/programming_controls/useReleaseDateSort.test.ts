import { v4 } from 'uuid';
import { describe, expect, test } from 'vitest';
import { sortProgramsByReleaseDate } from './useReleaseDateSort';
import type { ChannelProgram } from '@tunarr/types';
import { map } from 'lodash-es';
import {
  makeContentProgram,
  makeEpisode,
  makeMovie,
  makeSeasonGrouping,
} from '../../test/programFixtures.ts';

describe('useReleaseDateSort', () => {
  test('use season and episode index as fallback to release date', () => {
    const one = v4(),
      two = v4(),
      three = v4();

    const episode = (
      id: string,
      episodeNumber: number,
      seasonIndex: number,
    ): ChannelProgram =>
      makeContentProgram(
        makeEpisode({
          uuid: id,
          episodeNumber,
          releaseDate: 0,
          season: makeSeasonGrouping(seasonIndex),
        }),
        0,
        id,
      );

    const before: ChannelProgram[] = [
      episode(one, 7, 3),
      episode(two, 1, 2),
      episode(three, 2, 3),
    ];

    const sortedPrograms = sortProgramsByReleaseDate(before, 'asc');

    expect(map(sortedPrograms, 'id')).toEqual([two, three, one]);
  });

  test.each(['asc', 'desc'] as const)(
    'moves programs without a release date to the bottom (%s)',
    (sortOrder) => {
      const movie = (id: string, releaseDate?: number): ChannelProgram =>
        makeContentProgram(makeMovie({ uuid: id, releaseDate }), 0, id);

      const sortedPrograms = sortProgramsByReleaseDate(
        [movie('undated'), movie('old', 100), movie('new', 200)],
        sortOrder,
      );

      expect(map(sortedPrograms, 'id')).toEqual(
        sortOrder === 'asc'
          ? ['old', 'new', 'undated']
          : ['new', 'old', 'undated'],
      );
    },
  );
});
