import type { CondensedChannelProgram, ContentProgram } from '@tunarr/types';
import { describe, expect, test } from 'vitest';
import { condensedProgramToLineupItem } from '../db/channel/lineupItemConversion.ts';
import { MaterializeLineupCommand } from './MaterializeLineupCommand.ts';

const movieDurationMs = 100 * 60 * 1000;
const segmentDurationMs = 20 * 60 * 1000;

const movie: ContentProgram = {
  type: 'content',
  id: 'movie-1',
  uniqueId: 'movie-1',
  duration: movieDurationMs,
  program: {
    type: 'movie',
    sourceType: 'local',
    mediaSourceId: 'source-1',
    externalId: 'ext-1',
    canonicalId: 'canonical-1',
    libraryId: 'library-1',
    title: 'Movie',
  } as ContentProgram['program'],
};

function customSegment(startOffsetMs: number): CondensedChannelProgram {
  return {
    type: 'custom',
    id: movie.id,
    customShowId: 'show-1',
    index: 0,
    duration: segmentDurationMs,
    startOffsetMs,
  };
}

describe('MaterializeLineupCommand.expandLineup', () => {
  test('keeps the segment duration and custom show of split custom programs', () => {
    const lineup = [customSegment(0), customSegment(segmentDurationMs)];

    const expanded = MaterializeLineupCommand.expandLineup(lineup, {
      [movie.id]: movie,
    });

    expect(expanded).toHaveLength(2);
    expect(expanded.map(condensedProgramToLineupItem)).toEqual([
      {
        type: 'content',
        id: movie.id,
        customShowId: 'show-1',
        durationMs: segmentDurationMs,
        startOffsetMs: 0,
      },
      {
        type: 'content',
        id: movie.id,
        customShowId: 'show-1',
        durationMs: segmentDurationMs,
        startOffsetMs: segmentDurationMs,
      },
    ]);
  });
});
