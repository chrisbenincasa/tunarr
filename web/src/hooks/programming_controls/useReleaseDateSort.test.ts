import { v4 } from 'uuid';
import { describe, expect, test } from 'vitest';
import { sortProgramsByReleaseDate } from './useReleaseDateSort';
import type { ChannelProgram } from '@tunarr/types';
import { map } from 'lodash-es';
import {
  makeContentProgram,
  makeEpisode,
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
});
