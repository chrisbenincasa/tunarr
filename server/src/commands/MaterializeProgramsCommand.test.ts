import type { ProgramGrouping, TerminalProgram } from '@tunarr/types';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { ApiProgramConverters } from '../api/ApiProgramConverters.ts';
import type { MediaSourceDB } from '../db/mediaSourceDB.ts';
import type {
  ProgramGroupingOrmWithRelations,
  ProgramWithRelationsOrm,
} from '../db/schema/derivedTypes.ts';
import { MaterializeProgramsCommand } from './MaterializeProgramsCommand.ts';

const mediaSourceId = 'source-1';
const libraryId = 'library-1';

function grouping(type: string): ProgramGroupingOrmWithRelations {
  return { uuid: `${type}-1`, type } as ProgramGroupingOrmWithRelations;
}

function dbProgram(
  type: ProgramWithRelationsOrm['type'],
  parents: Partial<ProgramWithRelationsOrm> = {},
): ProgramWithRelationsOrm {
  return {
    uuid: `${type}-program`,
    type,
    mediaSourceId,
    libraryId,
    ...parents,
  } as ProgramWithRelationsOrm;
}

// The API program's type comes from the converter stub, so a test can make it
// disagree with the database program's type.
function materialize(program: ProgramWithRelationsOrm, apiType = program.type) {
  vi.spyOn(ApiProgramConverters, 'convertProgram').mockImplementation(
    (p) => ({ uuid: p.uuid, type: apiType }) as TerminalProgram,
  );
  vi.spyOn(ApiProgramConverters, 'convertProgramGrouping').mockImplementation(
    (g) => ({ uuid: g.uuid, type: g.type }) as ProgramGrouping,
  );
  const mediaSourceDB = {
    getAll: vi
      .fn()
      .mockResolvedValue([
        { uuid: mediaSourceId, libraries: [{ uuid: libraryId }] },
      ]),
  };
  return new MaterializeProgramsCommand(
    mediaSourceDB as unknown as MediaSourceDB,
  ).execute([program]);
}

describe('MaterializeProgramsCommand', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('attaches the season and show to an episode', async () => {
    const [episode] = await materialize(
      dbProgram('episode', {
        season: grouping('season'),
        show: grouping('show'),
      } as Partial<ProgramWithRelationsOrm>),
    );

    expect(episode).toEqual({
      uuid: 'episode-program',
      type: 'episode',
      season: { uuid: 'season-1', type: 'season' },
      show: { uuid: 'show-1', type: 'show' },
    });
  });

  test('attaches the album and artist to a track', async () => {
    const [track] = await materialize(
      dbProgram('track', {
        album: grouping('album'),
        artist: grouping('artist'),
      } as Partial<ProgramWithRelationsOrm>),
    );

    expect(track).toEqual({
      uuid: 'track-program',
      type: 'track',
      album: { uuid: 'album-1', type: 'album' },
      artist: { uuid: 'artist-1', type: 'artist' },
    });
  });

  test('skips a parent whose converted type does not match', async () => {
    const [episode] = await materialize(
      dbProgram('episode', {
        season: grouping('album'),
        show: grouping('artist'),
      } as Partial<ProgramWithRelationsOrm>),
    );

    expect(episode).toEqual({ uuid: 'episode-program', type: 'episode' });
  });

  test.each(['movie', 'music_video', 'other_video'] as const)(
    'leaves a %s without parents',
    async (type) => {
      const [program] = await materialize(dbProgram(type));

      expect(program).toEqual({ uuid: `${type}-program`, type });
    },
  );

  test('attaches nothing when the API and database types disagree', async () => {
    const [program] = await materialize(
      dbProgram('track', {
        album: grouping('album'),
      } as Partial<ProgramWithRelationsOrm>),
      'episode',
    );

    expect(program).toEqual({ uuid: 'track-program', type: 'episode' });
  });
});
