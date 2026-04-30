import { SearchFilter } from '@tunarr/types/schemas';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import {
  BinarySearchClause,
  parsedSearchToRequest,
  SearchClause,
  searchFilterToString,
  SearchParser,
  tokenizeSearchQuery,
} from './searchUtil.js';

dayjs.extend(customParseFormat);

function parseAndCheckExpression(input: string) {
  const lexerResult = tokenizeSearchQuery(input);
  expect(lexerResult.errors, JSON.stringify(lexerResult.errors)).toHaveLength(
    0,
  );
  const parser = new SearchParser();
  parser.input = lexerResult.tokens;
  const query = parser.searchExpression();
  expect(parser.errors, JSON.stringify(parser.errors, null, 2)).toHaveLength(0);
  return query;
}

describe('search parser', () => {
  test('simple parse', () => {
    const input = 'genre IN [comedy, horror] OR title ~ "XYZ"';
    const query = parseAndCheckExpression(input);
    expect(query).toMatchObject({
      type: 'binary_clause',
      lhs: {
        type: 'single_query',
        field: 'genre',
        op: 'in',
        value: ['comedy', 'horror'],
      },
      op: 'or',
      rhs: {
        type: 'single_query',
        field: 'title',
        op: 'contains',
        value: 'XYZ',
      },
    } satisfies SearchClause);
  });

  test('parse values with other keywords', () => {
    const query = parseAndCheckExpression(
      'title IN ["Rick and Morty", "Murder, She Wrote", "Not Real"]',
    );
    expect(query).toMatchObject<SearchClause>({
      type: 'single_query',
      field: 'title',
      op: 'in',
      value: ['Rick and Morty', 'Murder, She Wrote', 'Not Real'],
    });
  });

  test('parse not contains (!~)', () => {
    const input = 'title !~ "XYZ"';
    const query = parseAndCheckExpression(input);
    expect(query).toMatchObject({
      type: 'single_query',
      field: 'title',
      op: 'not contains',
      value: 'XYZ',
    } satisfies SearchClause);
  });

  test('not contains round-trip', () => {
    const input = 'title !~ "XYZ"';
    const query = parseAndCheckExpression(input);
    const request = parsedSearchToRequest(query);
    expect(request).toMatchObject({
      type: 'value',
      fieldSpec: {
        op: 'not contains',
        value: ['XYZ'],
      },
    });
    expect(searchFilterToString(request)).toEqual(input);
  });

  test('parse NOT IN', () => {
    const input = 'genre NOT IN [comedy, horror]';
    const query = parseAndCheckExpression(input);
    expect(query).toMatchObject({
      type: 'single_query',
      field: 'genre',
      op: 'in',
      negate: true,
      value: ['comedy', 'horror'],
    } satisfies SearchClause);
  });

  test('parse string fields', () => {
    const input =
      'library_id = ddd327c3-aea2-4b27-a2c0-a8ce190d25d0 AND title <= A';
    const query = parseAndCheckExpression(input);
    expect(query).toMatchObject({
      type: 'binary_clause',
      lhs: {
        type: 'single_query',
        field: 'library_id',
        op: '=',
        value: 'ddd327c3-aea2-4b27-a2c0-a8ce190d25d0',
      },
      op: 'and',
      rhs: {
        type: 'single_query',
        field: 'title',
        op: '<=',
        value: 'A',
      },
    } satisfies SearchClause);
  });

  test('parse date fields', () => {
    const input = 'release_date = 2025-01-01';
    const query = parseAndCheckExpression(input);
    expect(query).toMatchObject({
      type: 'single_date_query',
      field: 'release_date',
      op: '=',
      value: '2025-01-01',
    } satisfies SearchClause);
  });

  test('parse numeric fields', () => {
    const input = 'duration >= 10';
    const query = parseAndCheckExpression(input);
    expect(query).toMatchObject({
      type: 'single_numeric_query',
      field: 'duration',
      op: '>=',
      value: 10,
    } satisfies SearchClause);
  });

  test('can parse uuids', () => {
    const input =
      'library_id = ddd327c3-aea2-4b27-a2c0-a8ce190d25d0 AND title <= A';
    const query = parseAndCheckExpression(input);
    expect(query).toMatchObject({
      type: 'binary_clause',
      lhs: {
        type: 'single_query',
        field: 'library_id',
        op: '=',
        value: 'ddd327c3-aea2-4b27-a2c0-a8ce190d25d0',
      },
      rhs: {
        type: 'single_query',
        field: 'title',
        op: '<=',
        value: 'A',
      },
      op: 'and',
    } satisfies BinarySearchClause);
  });

  test('supports numeric between inclusive', () => {
    const input = 'duration between [100, 200]';
    const query = parseAndCheckExpression(input);
    expect(query).toMatchObject({
      type: 'single_numeric_query',
      field: 'duration',
      includeHigher: true,
      includeLow: true,
      op: 'between',
      value: [100, 200],
    } satisfies SearchClause);
  });

  test('supports numeric between half open', () => {
    const input = 'duration between [100, 200)';
    const query = parseAndCheckExpression(input);
    expect(query).toMatchObject({
      type: 'single_numeric_query',
      field: 'duration',
      includeHigher: false,
      includeLow: true,
      op: 'between',
      value: [100, 200],
    } satisfies SearchClause);

    const input2 = 'duration between (100, 200]';
    const query2 = parseAndCheckExpression(input2);
    expect(query2).toMatchObject({
      type: 'single_numeric_query',
      field: 'duration',
      includeHigher: true,
      includeLow: false,
      op: 'between',
      value: [100, 200],
    } satisfies SearchClause);
  });

  test('compound queries', () => {
    const input = 'duration between [100, 200] AND title <= A';
    const query = parseAndCheckExpression(input);
    expect(query).toMatchObject({
      type: 'binary_clause',
      op: 'and',
      lhs: {
        type: 'single_numeric_query',
        field: 'duration',
        includeHigher: true,
        includeLow: true,
        op: 'between',
        value: [100, 200],
      },
      rhs: {
        type: 'single_query',
        field: 'title',
        op: '<=',
        value: 'A',
      },
    } satisfies SearchClause);
  });

  test('compound query with date', () => {
    const input = 'release_date < 2020-01-01 AND title <= A';
    const query = parseAndCheckExpression(input);
    expect(query).toMatchObject({
      type: 'binary_clause',
      op: 'and',
      lhs: {
        type: 'single_date_query',
        field: 'release_date',
        op: '<',
        value: '2020-01-01',
      },
      rhs: {
        type: 'single_query',
        field: 'title',
        op: '<=',
        value: 'A',
      },
    } satisfies SearchClause);
  });

  test('compound query with parens', () => {
    const input = `(type = "episode" AND minutes > 5 AND year < 1990 AND show_genre = "Animation") AND (rating in ["G", "TV-G", "Y"] OR (rating = "Not Rated" AND show_studio = "Hanna-Barbera Cartoons"))`;

    const query = parseAndCheckExpression(input);
    const request = parsedSearchToRequest(query);

    expect(searchFilterToString(request)).toEqual(input);

    const input2 = `type = "episode" AND minutes > 5 AND year < 1990 AND show_genre = "Animation" AND (rating in ["G", "TV-G", "Y"] OR (rating = "Not Rated" AND show_studio = "Hanna-Barbera Cartoons"))`;

    const query2 = parseAndCheckExpression(input2);

    const request2 = parsedSearchToRequest(query2);
    expect(searchFilterToString(request2)).toEqual(input2);
  });

  test('parse and stringify range queries', () => {
    const input = `type = "episode" AND minutes > 5 AND release_year between [1980, 1989] AND show_tags = "Primetime"`;
    const query = parseAndCheckExpression(input);
    const request = parsedSearchToRequest(query);

    expect(searchFilterToString(request)).toEqual(input);
  });

  test('parse library_name', () => {
    const input = `library_name = "library"`;

    const query = parseAndCheckExpression(input);
    const request = parsedSearchToRequest(query);

    expect(searchFilterToString(request)).toEqual(input);
  });
});

describe('parsedSearchToRequest', () => {
  test('handles inclusive numeric between', () => {
    const clause = {
      type: 'single_numeric_query',
      field: 'duration',
      includeHigher: true,
      includeLow: true,
      op: 'between',
      value: [100, 200],
    } satisfies SearchClause;

    const request = parsedSearchToRequest(clause);

    expect(request).toEqual({
      type: 'value',
      fieldSpec: {
        key: 'duration',
        name: 'duration',
        op: 'to',
        type: 'numeric',
        value: [100, 200],
      },
    } satisfies SearchFilter);
  });

  test('handles exclusive numeric between', () => {
    const clause = {
      type: 'single_numeric_query',
      field: 'duration',
      includeHigher: false,
      includeLow: false,
      op: 'between',
      value: [100, 200],
    } satisfies SearchClause;

    const request = parsedSearchToRequest(clause);

    const lhs = {
      type: 'value',
      fieldSpec: {
        key: 'duration',
        name: 'duration',
        op: '>',
        type: 'numeric',
        value: 100,
      },
    } satisfies SearchFilter;

    const rhs = {
      type: 'value',
      fieldSpec: {
        key: 'duration',
        name: 'duration',
        op: '<',
        type: 'numeric',
        value: 200,
      },
    } satisfies SearchFilter;

    expect(request).toEqual({
      type: 'op',
      op: 'and',
      children: [lhs, rhs],
    } satisfies SearchFilter);
  });

  test('handles date parsing with YYYY-MM-DD', () => {
    const clause = {
      type: 'single_date_query',
      field: 'release_date',
      op: '=',
      value: '2023-01-01',
    } satisfies SearchClause;

    const request = parsedSearchToRequest(clause);

    expect(request).toMatchObject({
      type: 'value',
      fieldSpec: {
        key: 'originalReleaseDate',
        op: '=',
        type: 'date',
        value: +dayjs('2023-01-01', 'YYYY-MM-DD'),
      },
    });
  });

  test('handles date parsing with YYYYMMDD', () => {
    const clause = {
      type: 'single_date_query',
      field: 'release_date',
      op: '=',
      value: '20230101',
    } satisfies SearchClause;

    const request = parsedSearchToRequest(clause);

    expect(request).toMatchObject({
      type: 'value',
      fieldSpec: {
        key: 'originalReleaseDate',
        op: '=',
        type: 'date',
        value: +dayjs('20230101', 'YYYYMMDD'),
      },
    });
  });

  test('handles date between query', () => {
    const clause = {
      type: 'single_date_query',
      field: 'release_date',
      op: 'between',
      value: ['2023-01-01', '2023-12-31'],
      includeLow: true,
      includeHigher: true,
    } satisfies SearchClause;

    const request = parsedSearchToRequest(clause);

    expect(request).toMatchObject({
      type: 'value',
      fieldSpec: {
        key: 'originalReleaseDate',
        op: 'to',
        type: 'date',
        value: [
          +dayjs('2023-01-01', 'YYYY-MM-DD'),
          +dayjs('2023-12-31', 'YYYY-MM-DD'),
        ],
      },
    });
  });

  test('converts virtual field key and value', () => {
    const clause = {
      type: 'single_numeric_query',
      field: 'minutes',
      op: '<=',
      value: 30,
    } satisfies SearchClause;

    const request = parsedSearchToRequest(clause);

    expect(request).toMatchObject({
      type: 'value',
      fieldSpec: {
        key: 'duration',
        name: 'minutes',
        op: '<=',
        type: 'numeric',
        value: 30 * 60 * 1000,
      },
    } satisfies SearchFilter);
  });

  test('handles studio search', () => {
    const clause = {
      type: 'single_query',
      field: 'studio',
      op: 'contains',
      value: 'Pixar',
    } satisfies SearchClause;

    const request = parsedSearchToRequest(clause);

    expect(request).toMatchObject({
      type: 'value',
      fieldSpec: {
        key: 'studio.name',
        name: 'studio',
        op: 'contains',
        type: 'faceted_string',
        value: ['Pixar'],
      },
    } satisfies SearchFilter);
  });

  test('negates queries', () => {
    const parsed = {
      type: 'single_query',
      field: 'genre',
      op: 'in',
      negate: true,
      value: ['comedy', 'horror'],
    } satisfies SearchClause;

    const request = parsedSearchToRequest(parsed);
    expect(request).toEqual({
      type: 'value',
      fieldSpec: {
        key: 'genres.name',
        name: 'genre',
        op: 'not in',
        type: 'faceted_string',
        value: ['comedy', 'horror'],
      },
    } satisfies SearchFilter);
  });

  describe('show virtual fields', () => {
    test('parse show_title', () => {
      const input = 'show_title:"The Twilight Zone"';
      const query = parseAndCheckExpression(input);
      expect(query).toMatchObject({
        type: 'single_query',
        field: 'show_title',
        op: '=',
        value: 'The Twilight Zone',
      } satisfies SearchClause);

      const request = parsedSearchToRequest(query);
      expect(request).toMatchObject({
        type: 'value',
        fieldSpec: {
          key: 'grandparent.title',
          name: 'show_title',
          op: '=',
          type: 'string',
          value: ['The Twilight Zone'],
        },
      } satisfies SearchFilter);
    });

    test('parse show_genre', () => {
      const input = 'show_genre:comedy';
      const query = parseAndCheckExpression(input);
      expect(query).toMatchObject({
        type: 'single_query',
        field: 'show_genre',
        op: '=',
        value: 'comedy',
      } satisfies SearchClause);
      const request = parsedSearchToRequest(query);
      expect(request).toMatchObject({
        type: 'value',
        fieldSpec: {
          key: 'grandparent.genres',
          name: 'show_genre',
          op: '=',
          type: 'faceted_string',
          value: ['comedy'],
        },
      } satisfies SearchFilter);
    });
  });

  test('handles audio_language mapping', () => {
    const clause = {
      type: 'single_query',
      field: 'audio_language',
      op: '=',
      value: 'eng',
    } satisfies SearchClause;

    const request = parsedSearchToRequest(clause);

    expect(request).toMatchObject({
      type: 'value',
      fieldSpec: {
        key: 'audioLanguages',
        name: 'audio_language',
        op: '=',
        type: 'faceted_string',
        value: ['eng'],
      },
    } satisfies SearchFilter);
  });

  test('handles subtitle_language mapping', () => {
    const clause = {
      type: 'single_query',
      field: 'subtitle_language',
      op: '=',
      value: 'fra',
    } satisfies SearchClause;

    const request = parsedSearchToRequest(clause);

    expect(request).toMatchObject({
      type: 'value',
      fieldSpec: {
        key: 'subtitleLanguages',
        name: 'subtitle_language',
        op: '=',
        type: 'faceted_string',
        value: ['fra'],
      },
    } satisfies SearchFilter);
  });
});

describe('searchFilterToString', () => {
  test('in with single value always produces brackets', () => {
    const filter = {
      type: 'value',
      fieldSpec: {
        key: 'genres.name',
        name: 'genre',
        op: 'in',
        type: 'faceted_string',
        value: ['comedy'],
      },
    } satisfies SearchFilter;

    expect(searchFilterToString(filter)).toEqual('genre in ["comedy"]');
  });

  test('not in with single value always produces brackets', () => {
    const filter = {
      type: 'value',
      fieldSpec: {
        key: 'genres.name',
        name: 'genre',
        op: 'not in',
        type: 'faceted_string',
        value: ['comedy'],
      },
    } satisfies SearchFilter;

    expect(searchFilterToString(filter)).toEqual('genre not in ["comedy"]');
  });

  test('in with multiple values produces brackets', () => {
    const filter = {
      type: 'value',
      fieldSpec: {
        key: 'genres.name',
        name: 'genre',
        op: 'in',
        type: 'faceted_string',
        value: ['comedy', 'horror'],
      },
    } satisfies SearchFilter;

    expect(searchFilterToString(filter)).toEqual(
      'genre in ["comedy", "horror"]',
    );
  });

  test('round-trips single-value in through parse and stringify', () => {
    const input = 'genre IN ["comedy"]';
    const lexerResult = tokenizeSearchQuery(input);
    expect(lexerResult.errors).toHaveLength(0);
    const parser = new SearchParser();
    parser.input = lexerResult.tokens;
    const query = parser.searchExpression();
    expect(parser.errors).toHaveLength(0);
    const request = parsedSearchToRequest(query);
    expect(searchFilterToString(request)).toEqual('genre in ["comedy"]');
  });

  test('starts with renders as < not literal "starts with"', () => {
    const filter = {
      type: 'value',
      fieldSpec: {
        key: 'title',
        name: 'title',
        op: 'starts with',
        type: 'string',
        value: ['The'],
      },
    } satisfies SearchFilter;

    expect(searchFilterToString(filter)).toEqual('title < "The"');
  });

  test('round-trips starts with through parse and stringify', () => {
    const input = 'title < "The"';
    const query = parseAndCheckExpression(input);
    const request = parsedSearchToRequest(query);
    expect(searchFilterToString(request)).toEqual(input);
  });

  // Relative date query tests
  test('parse release_date inthelast', () => {
    const input = 'release_date inthelast 2 weeks';
    const query = parseAndCheckExpression(input);
    expect(query).toMatchObject({
      type: 'single_date_query',
      field: 'release_date',
      op: 'inthelast',
      value: { amount: 2, unit: 'week' },
    } satisfies SearchClause);
  });

  test('parse release_date notinthelast', () => {
    const input = 'release_date notinthelast 3 months';
    const query = parseAndCheckExpression(input);
    expect(query).toMatchObject({
      type: 'single_date_query',
      field: 'release_date',
      op: 'notinthelast',
      value: { amount: 3, unit: 'month' },
    } satisfies SearchClause);
  });

  test('parse added_date inthelast', () => {
    const input = 'added_date inthelast 1 week';
    const query = parseAndCheckExpression(input);
    expect(query).toMatchObject({
      type: 'single_date_query',
      field: 'added_date',
      op: 'inthelast',
      value: { amount: 1, unit: 'week' },
    } satisfies SearchClause);
  });

  test('parse case-insensitive relative date', () => {
    const input = 'release_date INTHELAST 1 year';
    const query = parseAndCheckExpression(input);
    expect(query).toMatchObject({
      type: 'single_date_query',
      field: 'release_date',
      op: 'inthelast',
      value: { amount: 1, unit: 'year' },
    } satisfies SearchClause);
  });

  test('parse singular unit', () => {
    const input = 'release_date inthelast 1 day';
    const query = parseAndCheckExpression(input);
    expect(query).toMatchObject({
      type: 'single_date_query',
      field: 'release_date',
      op: 'inthelast',
      value: { amount: 1, unit: 'day' },
    } satisfies SearchClause);
  });

  test('parse plural unit', () => {
    const input = 'release_date inthelast 14 days';
    const query = parseAndCheckExpression(input);
    expect(query).toMatchObject({
      type: 'single_date_query',
      field: 'release_date',
      op: 'inthelast',
      value: { amount: 14, unit: 'day' },
    } satisfies SearchClause);
  });

  test('inthelast resolves to >= with epoch ms', () => {
    const clause = {
      type: 'single_date_query',
      field: 'release_date',
      op: 'inthelast',
      value: { amount: 2, unit: 'week' },
    } satisfies SearchClause;

    const before = +dayjs().subtract(2, 'week');
    const request = parsedSearchToRequest(clause);
    const after = +dayjs().subtract(2, 'week');

    expect(request).toMatchObject({
      type: 'value',
      fieldSpec: {
        key: 'originalReleaseDate',
        name: 'release_date',
        op: '>=',
        type: 'date',
        relativeDate: {
          op: 'inthelast',
          amount: 2,
          unit: 'week',
        },
      },
    });

    // The resolved value should be approximately 2 weeks ago
    const value = (request as { fieldSpec: { value: number } }).fieldSpec.value;
    expect(value).toBeGreaterThanOrEqual(before);
    expect(value).toBeLessThanOrEqual(after);
  });

  test('notinthelast resolves to < with epoch ms', () => {
    const clause = {
      type: 'single_date_query',
      field: 'release_date',
      op: 'notinthelast',
      value: { amount: 3, unit: 'month' },
    } satisfies SearchClause;

    const request = parsedSearchToRequest(clause);

    expect(request).toMatchObject({
      type: 'value',
      fieldSpec: {
        key: 'originalReleaseDate',
        name: 'release_date',
        op: '<',
        type: 'date',
        relativeDate: {
          op: 'notinthelast',
          amount: 3,
          unit: 'month',
        },
      },
    });
  });

  test('added_date maps to addedAt index field', () => {
    const clause = {
      type: 'single_date_query',
      field: 'added_date',
      op: 'inthelast',
      value: { amount: 1, unit: 'week' },
    } satisfies SearchClause;

    const request = parsedSearchToRequest(clause);

    expect(request).toMatchObject({
      type: 'value',
      fieldSpec: {
        key: 'addedAt',
        name: 'added_date',
        op: '>=',
        type: 'date',
      },
    });
  });

  test('round-trip relative date through parse and stringify', () => {
    const input = 'release_date inthelast 2 weeks';
    const query = parseAndCheckExpression(input);
    const request = parsedSearchToRequest(query);
    expect(searchFilterToString(request)).toEqual(input);
  });

  test('round-trip notinthelast through parse and stringify', () => {
    const input = 'release_date notinthelast 1 month';
    const query = parseAndCheckExpression(input);
    const request = parsedSearchToRequest(query);
    expect(searchFilterToString(request)).toEqual(input);
  });

  test('round-trip singular unit', () => {
    const input = 'release_date inthelast 1 day';
    const query = parseAndCheckExpression(input);
    const request = parsedSearchToRequest(query);
    expect(searchFilterToString(request)).toEqual(input);
  });

  test('compound query with relative date', () => {
    const input = 'release_date inthelast 2 weeks AND genre = "comedy"';
    const query = parseAndCheckExpression(input);
    expect(query).toMatchObject({
      type: 'binary_clause',
      op: 'and',
      lhs: {
        type: 'single_date_query',
        field: 'release_date',
        op: 'inthelast',
        value: { amount: 2, unit: 'week' },
      },
      rhs: {
        type: 'single_query',
        field: 'genre',
        op: '=',
        value: 'comedy',
      },
    } satisfies SearchClause);
  });
});

describe('dateValue parser rule', () => {
  function parseDateValue(input: string): string {
    const lexerResult = tokenizeSearchQuery(input);
    expect(lexerResult.errors, JSON.stringify(lexerResult.errors)).toHaveLength(
      0,
    );
    const parser = new SearchParser();
    parser.input = lexerResult.tokens;
    // Access private rule at runtime for unit testing
    const result = (parser as any).dateValue();
    expect(parser.errors, JSON.stringify(parser.errors, null, 2)).toHaveLength(
      0,
    );
    return result;
  }

  function expectDateValueRejected(input: string) {
    const lexerResult = tokenizeSearchQuery(input);
    if (lexerResult.errors.length > 0) {
      return;
    }
    const parser = new SearchParser();
    parser.input = lexerResult.tokens;
    (parser as any).dateValue();
    expect(parser.errors.length).toBeGreaterThan(0);
  }

  describe('accepts YYYY-MM-DD format', () => {
    test('unquoted', () => {
      expect(parseDateValue('2025-03-02')).toBe('2025-03-02');
    });

    test('quoted', () => {
      expect(parseDateValue('"2025-03-02"')).toBe('2025-03-02');
    });

    test('first day of year', () => {
      expect(parseDateValue('2025-01-01')).toBe('2025-01-01');
    });

    test('last day of year', () => {
      expect(parseDateValue('2025-12-31')).toBe('2025-12-31');
    });

    test('year 2000 boundary', () => {
      expect(parseDateValue('2000-01-01')).toBe('2000-01-01');
    });

    test('far future date', () => {
      expect(parseDateValue('2099-06-15')).toBe('2099-06-15');
    });

    test('far past date', () => {
      expect(parseDateValue('1900-01-01')).toBe('1900-01-01');
    });
  });

  describe('accepts YYYYMMDD format', () => {
    test('unquoted', () => {
      expect(parseDateValue('20250302')).toBe('20250302');
    });

    test('quoted', () => {
      expect(parseDateValue('"20250302"')).toBe('20250302');
    });

    test('year 1999 compact', () => {
      expect(parseDateValue('19991231')).toBe('19991231');
    });
  });

  describe('rejects invalid formats', () => {
    test('single-digit month and day', () => {
      expectDateValueRejected('2025-3-2');
    });

    test('two-digit year', () => {
      expectDateValueRejected('25-03-02');
    });

    test('plain text', () => {
      expectDateValueRejected('hello');
    });

    test('year-month only', () => {
      expectDateValueRejected('2025-03');
    });

    test('6-digit number', () => {
      expectDateValueRejected('202503');
    });

    test('5-digit number', () => {
      expectDateValueRejected('12345');
    });

    test('9-digit number', () => {
      expectDateValueRejected('123456789');
    });

    test('4-digit year only', () => {
      expectDateValueRejected('2025');
    });

    test('extra date segments', () => {
      expectDateValueRejected('2025-03-02-01');
    });

    test('slash-separated date', () => {
      expectDateValueRejected('2025/03/02');
    });

    test('dot-separated date', () => {
      expectDateValueRejected('2025.03.02');
    });

    test('empty quoted string', () => {
      expectDateValueRejected('""');
    });

    test('quoted non-date string', () => {
      expectDateValueRejected('"hello"');
    });

    test('quoted incomplete date', () => {
      expectDateValueRejected('"2025-03"');
    });

    test('quoted 6-digit number', () => {
      expectDateValueRejected('"202503"');
    });

    test('floating point number', () => {
      expectDateValueRejected('2025.0302');
    });

    test('space-separated digits', () => {
      expectDateValueRejected('2025 0302');
    });
  });

  describe('full date queries', () => {
    test('equality with YYYY-MM-DD', () => {
      const query = parseAndCheckExpression('release_date = 2025-01-01');
      expect(query).toMatchObject({
        type: 'single_date_query',
        field: 'release_date',
        op: '=',
        value: '2025-01-01',
      } satisfies SearchClause);
    });

    test('equality with YYYYMMDD', () => {
      const query = parseAndCheckExpression('release_date = 20250101');
      expect(query).toMatchObject({
        type: 'single_date_query',
        field: 'release_date',
        op: '=',
        value: '20250101',
      } satisfies SearchClause);
    });

    test('equality with colon operator', () => {
      const query = parseAndCheckExpression('release_date:2025-01-01');
      expect(query).toMatchObject({
        type: 'single_date_query',
        field: 'release_date',
        op: '=',
        value: '2025-01-01',
      } satisfies SearchClause);
    });

    test('less than', () => {
      const query = parseAndCheckExpression('release_date < 2020-01-01');
      expect(query).toMatchObject({
        type: 'single_date_query',
        field: 'release_date',
        op: '<',
        value: '2020-01-01',
      } satisfies SearchClause);
    });

    test('less than or equal', () => {
      const query = parseAndCheckExpression('release_date <= 2020-12-31');
      expect(query).toMatchObject({
        type: 'single_date_query',
        field: 'release_date',
        op: '<=',
        value: '2020-12-31',
      } satisfies SearchClause);
    });

    test('greater than', () => {
      const query = parseAndCheckExpression('release_date > 2020-01-01');
      expect(query).toMatchObject({
        type: 'single_date_query',
        field: 'release_date',
        op: '>',
        value: '2020-01-01',
      } satisfies SearchClause);
    });

    test('greater than or equal', () => {
      const query = parseAndCheckExpression('release_date >= 2020-01-01');
      expect(query).toMatchObject({
        type: 'single_date_query',
        field: 'release_date',
        op: '>=',
        value: '2020-01-01',
      } satisfies SearchClause);
    });

    test('between inclusive with YYYY-MM-DD', () => {
      const query = parseAndCheckExpression(
        'release_date between [2020-01-01, 2023-12-31]',
      );
      expect(query).toMatchObject({
        type: 'single_date_query',
        field: 'release_date',
        op: 'between',
        value: ['2020-01-01', '2023-12-31'],
        includeLow: true,
        includeHigher: true,
      } satisfies SearchClause);
    });

    test('between exclusive with YYYYMMDD', () => {
      const query = parseAndCheckExpression(
        'release_date between (20200101, 20231231)',
      );
      expect(query).toMatchObject({
        type: 'single_date_query',
        field: 'release_date',
        op: 'between',
        value: ['20200101', '20231231'],
        includeLow: false,
        includeHigher: false,
      } satisfies SearchClause);
    });

    test('between half-open with mixed formats', () => {
      const query = parseAndCheckExpression(
        'release_date between [20200101, 2023-12-31)',
      );
      expect(query).toMatchObject({
        type: 'single_date_query',
        field: 'release_date',
        op: 'between',
        value: ['20200101', '2023-12-31'],
        includeLow: true,
        includeHigher: false,
      } satisfies SearchClause);
    });

    test('quoted date value in equality', () => {
      const query = parseAndCheckExpression('release_date = "2025-06-15"');
      expect(query).toMatchObject({
        type: 'single_date_query',
        field: 'release_date',
        op: '=',
        value: '2025-06-15',
      } satisfies SearchClause);
    });

    test('compound: date AND string', () => {
      const query = parseAndCheckExpression(
        'release_date > 2020-01-01 AND title ~ "Matrix"',
      );
      expect(query).toMatchObject({
        type: 'binary_clause',
        op: 'and',
        lhs: {
          type: 'single_date_query',
          field: 'release_date',
          op: '>',
          value: '2020-01-01',
        },
        rhs: {
          type: 'single_query',
          field: 'title',
          op: 'contains',
          value: 'Matrix',
        },
      } satisfies SearchClause);
    });

    test('compound: string AND date between', () => {
      const query = parseAndCheckExpression(
        'type = "movie" AND release_date between [2020-01-01, 2025-12-31]',
      );
      expect(query).toMatchObject({
        type: 'binary_clause',
        op: 'and',
        lhs: {
          type: 'single_query',
          field: 'type',
          op: '=',
          value: 'movie',
        },
        rhs: {
          type: 'single_date_query',
          field: 'release_date',
          op: 'between',
          value: ['2020-01-01', '2025-12-31'],
          includeLow: true,
          includeHigher: true,
        },
      } satisfies SearchClause);
    });

    test('compound: date AND numeric AND string', () => {
      const query = parseAndCheckExpression(
        'release_date >= 2000-01-01 AND minutes > 90 AND genre = "Action"',
      );
      expect(query).toMatchObject({
        type: 'binary_clause',
        op: 'and',
        lhs: {
          type: 'single_date_query',
          field: 'release_date',
          op: '>=',
          value: '2000-01-01',
        },
        rhs: {
          type: 'binary_clause',
          op: 'and',
          lhs: {
            type: 'single_numeric_query',
            field: 'minutes',
            op: '>',
            value: 90,
          },
          rhs: {
            type: 'single_query',
            field: 'genre',
            op: '=',
            value: 'Action',
          },
        },
      } satisfies SearchClause);
    });

    test('date in parenthesized group', () => {
      const query = parseAndCheckExpression(
        '(release_date >= 2020-01-01 AND release_date <= 2025-12-31) OR genre = "Comedy"',
      );
      expect(query).toMatchObject({
        type: 'binary_clause',
        op: 'or',
        lhs: {
          type: 'search_group',
          clauses: [
            {
              type: 'binary_clause',
              op: 'and',
              lhs: {
                type: 'single_date_query',
                field: 'release_date',
                op: '>=',
                value: '2020-01-01',
              },
              rhs: {
                type: 'single_date_query',
                field: 'release_date',
                op: '<=',
                value: '2025-12-31',
              },
            },
          ],
        },
        rhs: {
          type: 'single_query',
          field: 'genre',
          op: '=',
          value: 'Comedy',
        },
      } satisfies SearchClause);
    });

    test('rejects invalid date in full query', () => {
      const lexerResult = tokenizeSearchQuery('release_date = hello');
      expect(lexerResult.errors).toHaveLength(0);
      const parser = new SearchParser();
      parser.input = lexerResult.tokens;
      parser.searchExpression();
      expect(parser.errors.length).toBeGreaterThan(0);
    });

    test('rejects incomplete date in full query', () => {
      const lexerResult = tokenizeSearchQuery('release_date = 2025-03');
      expect(lexerResult.errors).toHaveLength(0);
      const parser = new SearchParser();
      parser.input = lexerResult.tokens;
      parser.searchExpression();
      expect(parser.errors.length).toBeGreaterThan(0);
    });

    test('rejects 6-digit number in full query', () => {
      const lexerResult = tokenizeSearchQuery('release_date = 202503');
      expect(lexerResult.errors).toHaveLength(0);
      const parser = new SearchParser();
      parser.input = lexerResult.tokens;
      parser.searchExpression();
      expect(parser.errors.length).toBeGreaterThan(0);
    });
  });
});
