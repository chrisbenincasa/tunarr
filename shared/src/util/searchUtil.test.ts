import { SearchFilter } from '@tunarr/types/api';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import {
  parsedSearchToRequest,
  SearchClause,
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
    const lexerResult = tokenizeSearchQuery(input);
    const parser = new SearchParser();
    parser.input = lexerResult.tokens;
    console.log(lexerResult.tokens, parser.errors);
  });

  test('can parse uuids', () => {
    const input =
      'library_id = ddd327c3-aea2-4b27-a2c0-a8ce190d25d0 AND title <= A';
    const lexerResult = tokenizeSearchQuery(input);
    const parser = new SearchParser();
    parser.input = lexerResult.tokens;
    const query = parser.searchExpression();
    console.log(query);
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
        name: '',
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
        name: '',
        op: '>',
        type: 'numeric',
        value: 100,
      },
    } satisfies SearchFilter;

    const rhs = {
      type: 'value',
      fieldSpec: {
        key: 'duration',
        name: '',
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
        name: '',
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
        name: '',
        op: 'contains',
        type: 'string',
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
        name: '',
        op: 'not in',
        type: 'string',
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
          name: '',
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
          name: '',
          op: '=',
          type: 'string',
          value: ['comedy'],
        },
      } satisfies SearchFilter);
    });
  });
});
