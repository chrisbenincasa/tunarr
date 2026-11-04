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

  return { task, searchService, programStateRepo };
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

  test('deletes nothing when a row lookup fails', async () => {
    const { task, searchService, programStateRepo } = setup(
      [
        [{ id: 'movie-gone', type: 'movie' }],
        [{ id: 'show-gone', type: 'show' }],
      ],
      [],
      [],
    );
    programStateRepo.findExistingGroupingIds
      .mockResolvedValueOnce(new Set())
      .mockRejectedValueOnce(new Error('db down'));

    await task.run({}).catch(() => {});

    expect(searchService.deleteByIds).not.toHaveBeenCalled();
  });

  test('waits for the media source delete before scanning', async () => {
    const { task, searchService } = setup(
      [[{ id: 'movie-gone', type: 'movie' }]],
      [],
      [],
    );
    const events: string[] = [];
    searchService.deleteByMediaSourceIds.mockResolvedValue({ taskUid: 3 });
    searchService.monitorTask.mockImplementation(async (id: number) => {
      await Promise.resolve();
      events.push(`monitor-done:${id}`);
    });
    const pages = searchService.allProgramDocumentRefs;
    searchService.allProgramDocumentRefs = async function* () {
      events.push('scan-start');
      yield* pages();
    };

    await task.run({});

    expect(events).toEqual(['monitor-done:3', 'scan-start']);
    expect(searchService.deleteByIds).toHaveBeenCalledWith(['movie-gone']);
  });
});
