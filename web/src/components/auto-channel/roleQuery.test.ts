import { search } from '@tunarr/shared/util';
import type { ContentRequirement } from '@tunarr/types/api';
import { describe, expect, test } from 'vitest';
import {
  buildRoleQuery,
  combineFilters,
  hasRequiredPick,
} from './roleQuery.ts';

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

type Picker = Pick<ContentRequirement, 'pickerHint'>;

describe('hasRequiredPick', () => {
  const facet: Picker = {
    pickerHint: { type: 'facet', facetFields: ['genre'], label: 'Pick' },
  };

  test('waits for a facet pick', () => {
    expect(hasRequiredPick(facet, undefined)).toBe(false);
    expect(hasRequiredPick(facet, { facetValues: [], pickerFilter: '' })).toBe(
      false,
    );
    expect(
      hasRequiredPick(facet, {
        facetValues: ['Comedy'],
        pickerFilter: 'genre = "Comedy"',
      }),
    ).toBe(true);
  });

  test('waits for a show pick', () => {
    const show = {
      pickerHint: { type: 'single-show', label: 'Show' },
    } as const;
    expect(hasRequiredPick(show, {})).toBe(false);
    expect(
      hasRequiredPick(show, { show: { id: 'a', title: 'A', year: null } }),
    ).toBe(true);
  });

  test('waits for a year range', () => {
    const years = {
      pickerHint: { type: 'year-range', label: 'Years' },
    } as const;
    expect(hasRequiredPick(years, {})).toBe(false);
    expect(
      hasRequiredPick(years, {
        yearRange: { start: 1990, end: 1999 },
        pickerFilter: 'year >= 1990 AND year <= 1999',
      }),
    ).toBe(true);
  });

  test('roles without a picker are always ready', () => {
    expect(hasRequiredPick({}, undefined)).toBe(true);
  });
});
