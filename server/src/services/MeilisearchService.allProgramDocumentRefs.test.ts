import { describe, expect, test, vi } from 'vitest';
import type { ProgramSearchDocument } from './MeilisearchService.ts';
import { MeilisearchService } from './MeilisearchService.ts';

type Ref = Pick<ProgramSearchDocument, 'id' | 'type'>;

function serviceOver(total: number, pageCap = Infinity) {
  const docs: Ref[] = Array.from({ length: total }, (_, i) => ({
    id: `doc-${i}`,
    type: 'movie',
  }));
  const getDocuments = vi.fn(
    ({ offset, limit }: { offset: number; limit: number }) =>
      Promise.resolve({
        results: docs.slice(offset, offset + Math.min(limit, pageCap)),
        offset,
        limit,
        total,
      }),
  );
  const service = Object.create(
    MeilisearchService.prototype,
  ) as MeilisearchService;
  vi.spyOn(service, 'client').mockReturnValue({
    index: () => ({ getDocuments }),
  } as unknown as ReturnType<MeilisearchService['client']>);
  return { service, getDocuments };
}

async function collect(service: MeilisearchService, pageSize: number) {
  const pages: Ref[][] = [];
  for await (const page of service.allProgramDocumentRefs(pageSize)) {
    pages.push(page);
  }
  return pages;
}

describe('MeilisearchService.allProgramDocumentRefs', () => {
  test('yields every document when the total is not a multiple of the page size', async () => {
    const { service, getDocuments } = serviceOver(7);

    const pages = await collect(service, 3);

    expect(pages.map((page) => page.length)).toEqual([3, 3, 1]);
    expect(pages.flat().map(({ id }) => id)).toEqual(
      Array.from({ length: 7 }, (_, i) => `doc-${i}`),
    );
    expect(getDocuments).toHaveBeenCalledTimes(3);
    expect(getDocuments).toHaveBeenCalledWith({
      fields: ['id', 'type'],
      offset: 6,
      limit: 3,
    });
  });

  test('stops after the last full page without an extra request', async () => {
    const { service, getDocuments } = serviceOver(6);

    const pages = await collect(service, 3);

    expect(pages).toHaveLength(2);
    expect(getDocuments).toHaveBeenCalledTimes(2);
  });

  test('yields nothing for an empty index', async () => {
    const { service } = serviceOver(0);

    expect(await collect(service, 3)).toEqual([]);
  });

  test('advances by the number of documents returned, not the page size', async () => {
    const { service } = serviceOver(5, 2);

    const pages = await collect(service, 3);

    expect(pages.flat()).toHaveLength(5);
  });

  test('stops on an empty page even if the total says more remain', async () => {
    const { service, getDocuments } = serviceOver(3);
    getDocuments.mockResolvedValueOnce({
      results: [],
      offset: 0,
      limit: 3,
      total: 3,
    });

    expect(await collect(service, 3)).toEqual([]);
    expect(getDocuments).toHaveBeenCalledTimes(1);
  });
});
