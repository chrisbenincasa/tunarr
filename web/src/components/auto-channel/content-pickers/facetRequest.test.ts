import { describe, expect, test } from 'vitest';
import { facetRequest } from './facetRequest.ts';

describe('facetRequest', () => {
  test('always sends a JSON body', () => {
    expect(facetRequest('genres', '').body).toEqual({});
  });

  test('drops an empty facet query and passes the scope through', () => {
    expect(facetRequest('genres', '', 'src-1', 'lib-1')).toEqual({
      path: { facetName: 'genres' },
      query: {
        facetQuery: undefined,
        mediaSourceId: 'src-1',
        libraryId: 'lib-1',
      },
      body: {},
    });
  });

  test('passes a typed facet query', () => {
    expect(facetRequest('genres', 'com').query?.facetQuery).toBe('com');
  });
});
