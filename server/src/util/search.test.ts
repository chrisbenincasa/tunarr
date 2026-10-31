import { findDanglingSearchDocumentIds } from './search.ts';

const movie = (id: string) => ({ id, type: 'movie' as const });
const show = (id: string) => ({ id, type: 'show' as const });

describe('findDanglingSearchDocumentIds', () => {
  test('returns the documents whose program row is gone', () => {
    const docs = [movie('kept'), movie('deleted')];

    expect(
      findDanglingSearchDocumentIds(docs, new Set(['kept']), new Set()),
    ).toEqual(['deleted']);
  });

  test('checks groupings against the grouping rows', () => {
    const docs = [show('kept-show'), show('deleted-show')];

    // A grouping id among the program rows does not count as present.
    expect(
      findDanglingSearchDocumentIds(
        docs,
        new Set(['deleted-show']),
        new Set(['kept-show']),
      ),
    ).toEqual(['deleted-show']);
  });

  test('returns nothing when every document has a row', () => {
    const docs = [movie('a'), show('b')];

    expect(
      findDanglingSearchDocumentIds(docs, new Set(['a']), new Set(['b'])),
    ).toEqual([]);
  });
});
