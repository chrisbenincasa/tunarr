import type { CondensedChannelProgram, ContentProgram } from '@tunarr/types';
import { describe, expect, test, vi } from 'vitest';
import { condensedProgramToLineupItem } from '../db/channel/lineupItemConversion.ts';
import type { ProgramConverter } from '../db/converters/ProgramConverter.ts';
import type { IProgramDB } from '../db/interfaces/IProgramDB.ts';
import { MaterializeLineupCommand } from './MaterializeLineupCommand.ts';
import type { MaterializeProgramsCommand } from './MaterializeProgramsCommand.ts';

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

const filler: ContentProgram = {
  ...movie,
  id: 'filler-1',
  uniqueId: 'filler-1',
};
const fillerListId = 'a0d6c1f4-6f0e-4b8e-9c1a-2f4d5e6a7b8c';

const everyVariant: CondensedChannelProgram[] = [
  { type: 'content', id: movie.id, duration: segmentDurationMs },
  customSegment(0),
  { type: 'filler', id: filler.id, fillerListId, duration: 30_000 },
  {
    type: 'redirect',
    channel: 'channel-2',
    channelNumber: 2,
    channelName: 'Two',
    duration: 60_000,
  },
  { type: 'flex', duration: 90_000 },
];

describe('MaterializeLineupCommand.execute', () => {
  test('looks up programs for content, custom, and filler items only', async () => {
    const programDB = { getLineupProgramsByIds: vi.fn().mockResolvedValue([]) };
    const materializePrograms = { execute: vi.fn().mockResolvedValue([]) };
    const command = new MaterializeLineupCommand(
      programDB as unknown as IProgramDB,
      {} as ProgramConverter,
      materializePrograms as unknown as MaterializeProgramsCommand,
    );

    await command.execute({ lineup: everyVariant });

    expect(programDB.getLineupProgramsByIds).toHaveBeenCalledWith([
      movie.id,
      filler.id,
    ]);
  });
});

describe('MaterializeLineupCommand.expandLineup', () => {
  test('expands every lineup item type', () => {
    const expanded = MaterializeLineupCommand.expandLineup(everyVariant, {
      [movie.id]: movie,
      [filler.id]: filler,
    });

    expect(expanded).toEqual([
      { ...movie, duration: segmentDurationMs },
      { ...customSegment(0), program: movie },
      { ...everyVariant[2], program: filler },
      everyVariant[3],
      everyVariant[4],
    ]);
  });

  test('drops content, custom, and filler items whose program is missing', () => {
    const expanded = MaterializeLineupCommand.expandLineup(everyVariant, {});

    expect(expanded).toEqual([everyVariant[3], everyVariant[4]]);
  });

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
