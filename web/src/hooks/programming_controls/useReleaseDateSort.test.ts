import { v4 } from 'uuid';
import { describe, expect, test } from 'vitest';
import { sortProgramsByReleaseDate } from './useReleaseDateSort';
import { ChannelProgram } from '@tunarr/types';
import { map } from 'lodash-es';

describe('useReleaseDateSort', () => {
  test('use season and episode index as fallback to release date', () => {
    const one = v4(),
      two = v4(),
      three = v4();

    const before: Partial<ChannelProgram>[] = [
      {
        type: 'content',
        subtype: 'episode',
        date: '2024-04-20',
        id: one,
        seasonNumber: 3,
        episodeNumber: 7,
      },
      {
        type: 'content',
        date: '2024-04-20',
        subtype: 'episode',
        id: two,
        seasonNumber: 2,
        episodeNumber: 1,
      },
      {
        type: 'content',
        date: '2024-04-20',
        subtype: 'episode',
        id: three,
        seasonNumber: 3,
        episodeNumber: 2,
      },
    ];
    const sortedPrograms = sortProgramsByReleaseDate(before, 'asc');

    expect(map(sortedPrograms, 'id')).toEqual([two, three, one]);
  });
});
