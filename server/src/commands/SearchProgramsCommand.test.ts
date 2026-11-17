import type { IProgramDB } from '@/db/interfaces/IProgramDB.ts';
import type { MediaSourceDB } from '@/db/mediaSourceDB.ts';
import type { ProgramStateRepository } from '@/db/program/ProgramStateRepository.ts';
import type {
  MeilisearchService,
  ProgramSearchDocument,
} from '@/services/MeilisearchService.ts';
import { describe, expect, test, vi } from 'vitest';
import { SearchProgramsCommand } from './SearchProgramsCommand.ts';

type Ref = Pick<ProgramSearchDocument, 'id' | 'type'>;

type SetupOpts = {
  hits: Ref[];
  totalHits: number;
  loadedPrograms?: string[];
  loadedGroupings?: string[];
  programRows?: string[];
  groupingRows?: string[];
  lookupFails?: boolean;
  filterPaging?: { offset: number; limit: number };
};

function setup({
  hits,
  totalHits,
  loadedPrograms = [],
  loadedGroupings = [],
  programRows = loadedPrograms,
  groupingRows = loadedGroupings,
  lookupFails = false,
  filterPaging,
}: SetupOpts) {
  const results = hits.map((hit) => ({
    ...hit,
    mediaSourceId: 'source-1',
    libraryId: 'library-1',
  }));

  // A request with no text query takes the filter path, as the Trash page does.
  const response = filterPaging
    ? { type: 'filter', results, total: totalHits, ...filterPaging }
    : {
        type: 'search',
        results,
        page: 1,
        totalHits,
        hitsPerPage: 20,
        totalPages: Math.ceil(totalHits / 20),
        facetDistribution: {},
      };
  const searchService = {
    search: vi.fn().mockResolvedValue(response),
    deleteByIds: vi.fn().mockResolvedValue({ taskUid: 7 }),
    monitorTask: vi.fn().mockResolvedValue(undefined),
  };
  const mediaSourceDB = { getAll: vi.fn().mockResolvedValue([]) };
  const programDB = {
    getProgramsByIds: vi
      .fn()
      .mockResolvedValue(loadedPrograms.map((uuid) => ({ uuid }))),
    getProgramGroupings: vi
      .fn()
      .mockResolvedValue(
        Object.fromEntries(loadedGroupings.map((uuid) => [uuid, { uuid }])),
      ),
    getProgramGroupingChildCounts: vi.fn().mockResolvedValue({}),
  };
  const lookup = (rows: string[]) =>
    vi.fn((ids: string[]) =>
      lookupFails
        ? Promise.reject(new Error('db down'))
        : Promise.resolve(new Set(ids.filter((id) => rows.includes(id)))),
    );
  const programStateRepo = {
    findExistingProgramIds: lookup(programRows),
    findExistingGroupingIds: lookup(groupingRows),
  };

  const command = new SearchProgramsCommand(
    searchService as unknown as MeilisearchService,
    mediaSourceDB as unknown as MediaSourceDB,
    programDB as unknown as IProgramDB,
    programStateRepo as unknown as ProgramStateRepository,
  );

  return { command, searchService };
}

const request = { query: {}, limit: 20 };

describe('SearchProgramsCommand', () => {
  test('removes hits with no row and leaves them out of the totals', async () => {
    const { command, searchService } = setup({
      hits: [
        { id: 'movie-kept', type: 'movie' },
        { id: 'movie-gone', type: 'movie' },
        { id: 'show-gone', type: 'show' },
      ],
      totalHits: 3,
      loadedPrograms: ['movie-kept'],
    });

    const response = await command.execute(request);

    expect(searchService.deleteByIds).toHaveBeenCalledWith([
      'movie-gone',
      'show-gone',
    ]);
    expect(response.totalHits).toBe(1);
    expect(response.totalPages).toBe(1);
    await vi.waitFor(() =>
      expect(searchService.monitorTask).toHaveBeenCalledWith(7),
    );
  });

  test('keeps a hit that the loaded map missed but the DB still has', async () => {
    const { command, searchService } = setup({
      hits: [{ id: 'show-kept', type: 'show' }],
      totalHits: 1,
      loadedGroupings: [],
      groupingRows: ['show-kept'],
    });

    const response = await command.execute(request);

    expect(searchService.deleteByIds).not.toHaveBeenCalled();
    expect(response.totalHits).toBe(1);
  });

  test('deletes nothing when the confirming lookup fails', async () => {
    const { command, searchService } = setup({
      hits: [{ id: 'movie-gone', type: 'movie' }],
      totalHits: 1,
      lookupFails: true,
    });

    const response = await command.execute(request);

    expect(searchService.deleteByIds).not.toHaveBeenCalled();
    expect(response.totalHits).toBe(1);
  });

  test('leaves pruned hits out of the totals on the filter path', async () => {
    const { command, searchService } = setup({
      hits: [
        { id: 'movie-kept', type: 'movie' },
        { id: 'movie-gone', type: 'movie' },
        { id: 'show-gone', type: 'show' },
      ],
      totalHits: 45,
      loadedPrograms: ['movie-kept'],
      filterPaging: { offset: 40, limit: 20 },
    });

    const response = await command.execute(request);

    expect(searchService.deleteByIds).toHaveBeenCalledWith([
      'movie-gone',
      'show-gone',
    ]);
    expect(response.totalHits).toBe(43);
    expect(response.totalPages).toBe(3);
    expect(response.page).toBe(2);
  });

  test('counts text search pages by the hits per page Meilisearch used', async () => {
    const { command } = setup({
      hits: [
        { id: 'movie-kept', type: 'movie' },
        { id: 'movie-gone', type: 'movie' },
      ],
      totalHits: 100,
      loadedPrograms: ['movie-kept'],
    });

    // Meilisearch ignores limit when page is set and returns 20 hits per page.
    const response = await command.execute({
      query: { query: 'movie' },
      limit: 45,
    });

    expect(response.totalHits).toBe(99);
    expect(response.totalPages).toBe(5);
  });
});
