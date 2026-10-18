import { search } from '@tunarr/shared/util';
import { describe, expect, test } from 'vitest';
import { buildRoleQuery, combineFilters } from './roleQuery.ts';

function parses(filter: string) {
  const tokenized = search.tokenizeSearchQuery(filter);
  const parser = new search.SearchParser();
  parser.input = tokenized.tokens;
  parser.searchExpression();
  return tokenized.errors.length === 0 && parser.errors.length === 0;
}

describe('combineFilters', () => {
  test('returns undefined when every part is empty', () => {
    expect(combineFilters([undefined, '', '  '])).toBeUndefined();
  });

  test('returns a single part unwrapped', () => {
    expect(combineFilters(['genre = "Comedy"', undefined])).toBe(
      'genre = "Comedy"',
    );
  });

  test('wraps and ANDs several parts into a filter the DSL parses', () => {
    const combined = combineFilters([
      'genre in ["Comedy", "Drama"]',
      'year >= 1990 AND year <= 1999',
    ]);
    expect(combined).toBe(
      '(genre in ["Comedy", "Drama"]) AND (year >= 1990 AND year <= 1999)',
    );
    expect(parses(combined ?? '')).toBe(true);
  });
});

describe('buildRoleQuery', () => {
  test('applies the global context to a role nobody touched', () => {
    expect(
      buildRoleQuery({ programTypes: ['movie'] }, undefined, {
        mediaSourceId: 'src',
        libraryIds: ['lib'],
      }),
    ).toEqual({
      programTypes: ['movie'],
      mediaSourceIds: ['src'],
      libraryIds: ['lib'],
      groupingId: undefined,
      filterString: undefined,
    });
  });

  test('keeps the preset default scope when there is no global context', () => {
    const query = buildRoleQuery({ libraryIds: ['preset-lib'] }, undefined, {});
    expect(query.libraryIds).toEqual(['preset-lib']);
    expect(query.mediaSourceIds).toBeUndefined();
  });

  test('an override replaces the global context', () => {
    const query = buildRoleQuery(
      {},
      { override: { mediaSourceIds: ['other'], programTypes: ['track'] } },
      { mediaSourceId: 'src', libraryIds: ['lib'] },
    );
    expect(query.mediaSourceIds).toEqual(['other']);
    expect(query.libraryIds).toBeUndefined();
    expect(query.programTypes).toEqual(['track']);
  });

  test('combines picker and advanced filters instead of replacing one', () => {
    const query = buildRoleQuery(
      {},
      { pickerFilter: 'genre = "Comedy"', advancedFilter: 'year > 1980' },
      {},
    );
    expect(query.filterString).toBe('(genre = "Comedy") AND (year > 1980)');
  });

  test('a picked show sets the grouping and limits to episodes', () => {
    const query = buildRoleQuery(
      { programTypes: ['movie'] },
      { show: { id: 'show-1', title: 'Show', year: null } },
      {},
    );
    expect(query.groupingId).toBe('show-1');
    expect(query.programTypes).toEqual(['episode']);
  });
});
