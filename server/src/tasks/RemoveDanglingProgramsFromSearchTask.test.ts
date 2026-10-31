import type { MediaSourceDB } from '@/db/mediaSourceDB.ts';
import type { ProgramStateRepository } from '@/db/program/ProgramStateRepository.ts';
import type {
  MeilisearchService,
  ProgramSearchDocument,
} from '@/services/MeilisearchService.ts';
import { describe, expect, test, vi } from 'vitest';
import { RemoveDanglingProgramsFromSearchTask } from './RemoveDanglingProgramsFromSearchTask.ts';

type Ref = Pick<ProgramSearchDocument, 'id' | 'type'>;

function setup(pages: Ref[][], programRows: string[], groupingRows: string[]) {
  const mediaSourceDB = {
    getAll: vi.fn().mockResolvedValue([{ uuid: 'source-1' }]),
  };
  const searchService = {
    deleteAll: vi.fn(),
    deleteByMediaSourceIds: vi.fn().mockResolvedValue(undefined),
    deleteByIds: vi.fn().mockResolvedValue(undefined),
    monitorTask: vi.fn().mockResolvedValue(undefined),
    allProgramDocumentRefs: async function* () {
      for (const page of pages) {
        yield page;
      }
    },
  };
  const programStateRepo = {
    findExistingProgramIds: vi.fn((ids: string[]) =>
      Promise.resolve(new Set(ids.filter((id) => programRows.includes(id)))),
    ),
    findExistingGroupingIds: vi.fn((ids: string[]) =>
      Promise.resolve(new Set(ids.filter((id) => groupingRows.includes(id)))),
    ),
  };

  const task = new RemoveDanglingProgramsFromSearchTask(
    mediaSourceDB as unknown as MediaSourceDB,
    searchService as unknown as MeilisearchService,
    programStateRepo as unknown as ProgramStateRepository,
  );

  return { task, searchService };
}

describe('RemoveDanglingProgramsFromSearchTask', () => {
  test('removes documents whose row is gone, across every page', async () => {
    const { task, searchService } = setup(
      [
        [
          { id: 'movie-kept', type: 'movie' },
          { id: 'movie-gone', type: 'movie' },
        ],
        [
          { id: 'show-kept', type: 'show' },
          { id: 'show-gone', type: 'show' },
        ],
      ],
      ['movie-kept'],
      ['show-kept'],
    );

    await task.run({});

    expect(searchService.deleteByMediaSourceIds).toHaveBeenCalledWith([
      'source-1',
    ]);
    expect(searchService.deleteByIds).toHaveBeenCalledExactlyOnceWith([
      'movie-gone',
      'show-gone',
    ]);
  });

  test('deletes nothing when every document has a row', async () => {
    const { task, searchService } = setup(
      [[{ id: 'movie-kept', type: 'movie' }]],
      ['movie-kept'],
      [],
    );

    await task.run({});

    expect(searchService.deleteByIds).not.toHaveBeenCalled();
  });
});
