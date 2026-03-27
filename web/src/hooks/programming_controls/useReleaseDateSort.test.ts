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

    const before = [
      {
        type: 'content',
        id: one,
        persisted: false,
        duration: 0,
        uniqueId: one,
        program: {
          type: 'episode',
          releaseDate: 0,
          episodeNumber: 7,
          season: { index: 3 },
        },
      },
      {
        type: 'content',
        id: two,
        persisted: false,
        duration: 0,
        uniqueId: two,
        program: {
          type: 'episode',
          releaseDate: 0,
          episodeNumber: 1,
          season: { index: 2 },
        },
      },
      {
        type: 'content',
        id: three,
        persisted: false,
        duration: 0,
        uniqueId: three,
        program: {
          type: 'episode',
          releaseDate: 0,
          episodeNumber: 2,
          season: { index: 3 },
        },
      },
    ] as ChannelProgram[];

    const sortedPrograms = sortProgramsByReleaseDate(before, 'asc');

    expect(map(sortedPrograms, 'id')).toEqual([two, three, one]);
  });
});
