import { SearchFilter } from '@tunarr/types/api';
import { describe, expect, test } from 'vitest';
import { MeilisearchService } from './MeilisearchService.js';

// Mock index configuration for testing
const mockIndex = {
  name: 'programs',
  primaryKey: 'id',
  filterable: [
    'title',
    'type',
    'genres.name',
    'duration',
    'originalReleaseDate',
    'originalReleaseYear',
    'libraryId',
    'mediaSourceId',
    'externalIds.sourceId',
    'grandparent.id',
    'parent.id',
    'state',
    'tags',
  ],
  sortable: ['title', 'duration', 'originalReleaseDate'],
  caseSensitiveFilters: [
    'libraryId',
    'mediaSourceId',
    'externalIds.sourceId',
    'grandparent.id',
    'parent.id',
  ],
};

describe('MeilisearchService.buildFilterExpression', () => {
  describe('string field filters', () => {
    test('single string equality', () => {
      const filter: SearchFilter = {
        type: 'value',
        fieldSpec: {
          key: 'title',
          name: 'Title',
          type: 'string',
          op: '=',
          value: ['The Matrix'],
        },
      };

      const result = MeilisearchService.buildFilterExpression(
        mockIndex,
        filter,
      );
      expect(result).toBe("title = 'The Matrix'");
    });

    test('single string with quotes', () => {
      const filter: SearchFilter = {
        type: 'value',
        fieldSpec: {
          key: 'title',
          name: 'Title',
          type: 'string',
          op: '=',
          value: [`Bob's Burgers`],
        },
      };

      const result = MeilisearchService.buildFilterExpression(
        mockIndex,
        filter,
      );
      expect(result).toBe("title = 'Bob\\\'s Burgers'");
    });

    test('single string with "in" operator maps to equality', () => {
      const filter: SearchFilter = {
        type: 'value',
        fieldSpec: {
          key: 'title',
          name: 'Title',
          type: 'string',
          op: 'in',
          value: ['The Matrix'],
        },
      };

      const result = MeilisearchService.buildFilterExpression(
        mockIndex,
        filter,
      );
      expect(result).toBe("title = 'The Matrix'");
    });

    test('single string with "not in" operator maps to inequality', () => {
      const filter: SearchFilter = {
        type: 'value',
        fieldSpec: {
          key: 'title',
          name: 'Title',
          type: 'string',
          op: 'not in',
          value: ['The Matrix'],
        },
      };

      const result = MeilisearchService.buildFilterExpression(
        mockIndex,
        filter,
      );
      expect(result).toBe("title != 'The Matrix'");
    });

    test('multiple strings with "in" operator', () => {
      const filter: SearchFilter = {
        type: 'value',
        fieldSpec: {
          key: 'title',
          name: 'Title',
          type: 'string',
          op: 'in',
          value: ['The Matrix', 'Inception', 'Interstellar', `Bob's Burgers`],
        },
      };

      const result = MeilisearchService.buildFilterExpression(
        mockIndex,
        filter,
      );
      expect(result).toBe(
        "title IN ['The Matrix', 'Inception', 'Interstellar', 'Bob\\\'s Burgers']",
      );
    });

    test('multiple strings with "not in" operator', () => {
      const filter: SearchFilter = {
        type: 'value',
        fieldSpec: {
          key: 'title',
          name: 'Title',
          type: 'string',
          op: 'not in',
          value: ['The Matrix', 'Inception'],
        },
      };

      const result = MeilisearchService.buildFilterExpression(
        mockIndex,
        filter,
      );
      expect(result).toBe("title NOT IN ['The Matrix', 'Inception']");
    });

    test('filters out empty strings from array', () => {
      const filter: SearchFilter = {
        type: 'value',
        fieldSpec: {
          key: 'title',
          name: 'Title',
          type: 'string',
          op: 'in',
          value: ['The Matrix', '', 'Inception'],
        },
      };

      const result = MeilisearchService.buildFilterExpression(
        mockIndex,
        filter,
      );
      expect(result).toBe("title IN ['The Matrix', 'Inception']");
    });

    test('returns empty string when all values are empty strings', () => {
      const filter: SearchFilter = {
        type: 'value',
        fieldSpec: {
          key: 'title',
          name: 'Title',
          type: 'string',
          op: 'in',
          value: ['', ''],
        },
      };

      const result = MeilisearchService.buildFilterExpression(
        mockIndex,
        filter,
      );
      expect(result).toBe('');
    });
  });

  describe('faceted string filters', () => {
    test('single faceted string', () => {
      const filter: SearchFilter = {
        type: 'value',
        fieldSpec: {
          key: 'genres.name',
          name: 'Genre',
          type: 'facted_string',
          op: 'in',
          value: ['comedy'],
        },
      };

      const result = MeilisearchService.buildFilterExpression(
        mockIndex,
        filter,
      );
      expect(result).toBe("genres.name = 'comedy'");
    });

    test('multiple faceted strings', () => {
      const filter: SearchFilter = {
        type: 'value',
        fieldSpec: {
          key: 'genres.name',
          name: 'Genre',
          type: 'facted_string',
          op: 'in',
          value: ['comedy', 'horror', 'action'],
        },
      };

      const result = MeilisearchService.buildFilterExpression(
        mockIndex,
        filter,
      );
      expect(result).toBe("genres.name IN ['comedy', 'horror', 'action']");
    });
  });

  describe('case-sensitive field encoding', () => {
    test('encodes case-sensitive field values', () => {
      const filter: SearchFilter = {
        type: 'value',
        fieldSpec: {
          key: 'libraryId',
          name: 'Library ID',
          type: 'string',
          op: '=',
          value: ['abc123'],
        },
      };

      const result = MeilisearchService.buildFilterExpression(
        mockIndex,
        filter,
      );
      // Should encode the value using base32 encoding (lowercase alphanumeric)
      expect(result).toMatch(/^libraryId = '[a-z0-9]+'$/);
      expect(result).not.toBe("libraryId = 'abc123'");
    });

    test('encodes case-sensitive field values in arrays', () => {
      const filter: SearchFilter = {
        type: 'value',
        fieldSpec: {
          key: 'mediaSourceId',
          name: 'Media Source ID',
          type: 'string',
          op: 'in',
          value: ['source1', 'source2'],
        },
      };

      const result = MeilisearchService.buildFilterExpression(
        mockIndex,
        filter,
      );
      // Should encode all values (lowercase alphanumeric)
      expect(result).toMatch(/^mediaSourceId IN \['[a-z0-9]+', '[a-z0-9]+'\]$/);
      expect(result).not.toContain('source1');
      expect(result).not.toContain('source2');
    });

    test('does not encode non-case-sensitive fields', () => {
      const filter: SearchFilter = {
        type: 'value',
        fieldSpec: {
          key: 'title',
          name: 'Title',
          type: 'string',
          op: '=',
          value: ['test'],
        },
      };

      const result = MeilisearchService.buildFilterExpression(
        mockIndex,
        filter,
      );
      expect(result).toBe("title = 'test'");
    });
  });

  describe('numeric field filters', () => {
    test('numeric equality', () => {
      const filter: SearchFilter = {
        type: 'value',
        fieldSpec: {
          key: 'duration',
          name: 'Duration',
          type: 'numeric',
          op: '=',
          value: 3600,
        },
      };

      const result = MeilisearchService.buildFilterExpression(
        mockIndex,
        filter,
      );
      expect(result).toBe('duration = 3600');
    });

    test('numeric greater than', () => {
      const filter: SearchFilter = {
        type: 'value',
        fieldSpec: {
          key: 'duration',
          name: 'Duration',
          type: 'numeric',
          op: '>',
          value: 1800,
        },
      };

      const result = MeilisearchService.buildFilterExpression(
        mockIndex,
        filter,
      );
      expect(result).toBe('duration > 1800');
    });

    test('numeric less than or equal', () => {
      const filter: SearchFilter = {
        type: 'value',
        fieldSpec: {
          key: 'duration',
          name: 'Duration',
          type: 'numeric',
          op: '<=',
          value: 7200,
        },
      };

      const result = MeilisearchService.buildFilterExpression(
        mockIndex,
        filter,
      );
      expect(result).toBe('duration <= 7200');
    });

    test('numeric range', () => {
      const filter: SearchFilter = {
        type: 'value',
        fieldSpec: {
          key: 'duration',
          name: 'Duration',
          type: 'numeric',
          op: 'to',
          value: [1800, 7200],
        },
      };

      const result = MeilisearchService.buildFilterExpression(
        mockIndex,
        filter,
      );
      expect(result).toBe('duration 1800 TO 7200');
    });
  });

  describe('date field filters', () => {
    test('date equality', () => {
      const filter: SearchFilter = {
        type: 'value',
        fieldSpec: {
          key: 'originalReleaseDate',
          name: 'Release Date',
          type: 'date',
          op: '=',
          value: 1609459200000, // 2021-01-01 in milliseconds
        },
      };

      const result = MeilisearchService.buildFilterExpression(
        mockIndex,
        filter,
      );
      expect(result).toBe('originalReleaseDate = 1609459200000');
    });

    test('date greater than', () => {
      const filter: SearchFilter = {
        type: 'value',
        fieldSpec: {
          key: 'originalReleaseDate',
          name: 'Release Date',
          type: 'date',
          op: '>',
          value: 1609459200000,
        },
      };

      const result = MeilisearchService.buildFilterExpression(
        mockIndex,
        filter,
      );
      expect(result).toBe('originalReleaseDate > 1609459200000');
    });

    test('date range', () => {
      const filter: SearchFilter = {
        type: 'value',
        fieldSpec: {
          key: 'originalReleaseDate',
          name: 'Release Date',
          type: 'date',
          op: 'to',
          value: [1609459200000, 1640995200000],
        },
      };

      const result = MeilisearchService.buildFilterExpression(
        mockIndex,
        filter,
      );
      expect(result).toBe('originalReleaseDate 1609459200000 TO 1640995200000');
    });
  });

  describe('operator nodes', () => {
    test('AND operator with two conditions', () => {
      const filter: SearchFilter = {
        type: 'op',
        op: 'and',
        children: [
          {
            type: 'value',
            fieldSpec: {
              key: 'type',
              name: 'Type',
              type: 'string',
              op: '=',
              value: ['movie'],
            },
          },
          {
            type: 'value',
            fieldSpec: {
              key: 'duration',
              name: 'Duration',
              type: 'numeric',
              op: '>',
              value: 3600,
            },
          },
        ],
      };

      const result = MeilisearchService.buildFilterExpression(
        mockIndex,
        filter,
      );
      expect(result).toBe("type = 'movie' AND duration > 3600");
    });

    test('OR operator with two conditions', () => {
      const filter: SearchFilter = {
        type: 'op',
        op: 'or',
        children: [
          {
            type: 'value',
            fieldSpec: {
              key: 'type',
              name: 'Type',
              type: 'string',
              op: '=',
              value: ['movie'],
            },
          },
          {
            type: 'value',
            fieldSpec: {
              key: 'type',
              name: 'Type',
              type: 'string',
              op: '=',
              value: ['episode'],
            },
          },
        ],
      };

      const result = MeilisearchService.buildFilterExpression(
        mockIndex,
        filter,
      );
      expect(result).toBe("type = 'movie' OR type = 'episode'");
    });

    test('AND operator with multiple conditions', () => {
      const filter: SearchFilter = {
        type: 'op',
        op: 'and',
        children: [
          {
            type: 'value',
            fieldSpec: {
              key: 'type',
              name: 'Type',
              type: 'string',
              op: '=',
              value: ['movie'],
            },
          },
          {
            type: 'value',
            fieldSpec: {
              key: 'duration',
              name: 'Duration',
              type: 'numeric',
              op: '>',
              value: 3600,
            },
          },
          {
            type: 'value',
            fieldSpec: {
              key: 'originalReleaseYear',
              name: 'Release Year',
              type: 'numeric',
              op: '>=',
              value: 2020,
            },
          },
        ],
      };

      const result = MeilisearchService.buildFilterExpression(
        mockIndex,
        filter,
      );
      expect(result).toBe(
        "type = 'movie' AND duration > 3600 AND originalReleaseYear >= 2020",
      );
    });

    test('empty children array returns empty string', () => {
      const filter: SearchFilter = {
        type: 'op',
        op: 'and',
        children: [],
      };

      const result = MeilisearchService.buildFilterExpression(
        mockIndex,
        filter,
      );
      expect(result).toBe('');
    });
  });

  describe('nested operator nodes', () => {
    test('nested AND within OR', () => {
      const filter: SearchFilter = {
        type: 'op',
        op: 'or',
        children: [
          {
            type: 'op',
            op: 'and',
            children: [
              {
                type: 'value',
                fieldSpec: {
                  key: 'type',
                  name: 'Type',
                  type: 'string',
                  op: '=',
                  value: ['movie'],
                },
              },
              {
                type: 'value',
                fieldSpec: {
                  key: 'duration',
                  name: 'Duration',
                  type: 'numeric',
                  op: '>',
                  value: 3600,
                },
              },
            ],
          },
          {
            type: 'value',
            fieldSpec: {
              key: 'type',
              name: 'Type',
              type: 'string',
              op: '=',
              value: ['episode'],
            },
          },
        ],
      };

      const result = MeilisearchService.buildFilterExpression(
        mockIndex,
        filter,
      );
      expect(result).toBe(
        "(type = 'movie' AND duration > 3600) OR type = 'episode'",
      );
    });

    test('complex nested structure', () => {
      const filter: SearchFilter = {
        type: 'op',
        op: 'and',
        children: [
          {
            type: 'op',
            op: 'or',
            children: [
              {
                type: 'value',
                fieldSpec: {
                  key: 'type',
                  name: 'Type',
                  type: 'string',
                  op: '=',
                  value: ['movie'],
                },
              },
              {
                type: 'value',
                fieldSpec: {
                  key: 'type',
                  name: 'Type',
                  type: 'string',
                  op: '=',
                  value: ['episode'],
                },
              },
            ],
          },
          {
            type: 'value',
            fieldSpec: {
              key: 'duration',
              name: 'Duration',
              type: 'numeric',
              op: '>',
              value: 1800,
            },
          },
        ],
      };

      const result = MeilisearchService.buildFilterExpression(
        mockIndex,
        filter,
      );
      expect(result).toBe(
        "(type = 'movie' OR type = 'episode') AND duration > 1800",
      );
    });

    test('deeply nested structure', () => {
      const filter: SearchFilter = {
        type: 'op',
        op: 'and',
        children: [
          {
            type: 'op',
            op: 'or',
            children: [
              {
                type: 'op',
                op: 'and',
                children: [
                  {
                    type: 'value',
                    fieldSpec: {
                      key: 'type',
                      name: 'Type',
                      type: 'string',
                      op: '=',
                      value: ['movie'],
                    },
                  },
                  {
                    type: 'value',
                    fieldSpec: {
                      key: 'originalReleaseYear',
                      name: 'Release Year',
                      type: 'numeric',
                      op: '>=',
                      value: 2020,
                    },
                  },
                ],
              },
              {
                type: 'value',
                fieldSpec: {
                  key: 'type',
                  name: 'Type',
                  type: 'string',
                  op: '=',
                  value: ['episode'],
                },
              },
            ],
          },
          {
            type: 'value',
            fieldSpec: {
              key: 'duration',
              name: 'Duration',
              type: 'numeric',
              op: '>',
              value: 1800,
            },
          },
        ],
      };

      const result = MeilisearchService.buildFilterExpression(
        mockIndex,
        filter,
      );
      expect(result).toBe(
        "((type = 'movie' AND originalReleaseYear >= 2020) OR type = 'episode') AND duration > 1800",
      );
    });
  });

  describe('edge cases', () => {
    test('handles single value array with empty string', () => {
      const filter: SearchFilter = {
        type: 'value',
        fieldSpec: {
          key: 'title',
          name: 'Title',
          type: 'string',
          op: 'in',
          value: [''],
        },
      };

      const result = MeilisearchService.buildFilterExpression(
        mockIndex,
        filter,
      );
      expect(result).toBe('');
    });

    test('operator with single child', () => {
      const filter: SearchFilter = {
        type: 'op',
        op: 'and',
        children: [
          {
            type: 'value',
            fieldSpec: {
              key: 'type',
              name: 'Type',
              type: 'string',
              op: '=',
              value: ['movie'],
            },
          },
        ],
      };

      const result = MeilisearchService.buildFilterExpression(
        mockIndex,
        filter,
      );
      expect(result).toBe("type = 'movie'");
    });

    test('operator with empty filter values', () => {
      const filter: SearchFilter = {
        type: 'op',
        op: 'and',
        children: [
          {
            type: 'value',
            fieldSpec: {
              key: 'title',
              name: 'Title',
              type: 'string',
              op: 'in',
              value: [''],
            },
          },
          {
            type: 'value',
            fieldSpec: {
              key: 'type',
              name: 'Type',
              type: 'string',
              op: '=',
              value: ['movie'],
            },
          },
        ],
      };

      const result = MeilisearchService.buildFilterExpression(
        mockIndex,
        filter,
      );
      // First child returns empty string, but is still included with operator
      expect(result).toBe("type = 'movie'");
    });

    test('all operator children produce empty strings', () => {
      const filter: SearchFilter = {
        type: 'op',
        op: 'and',
        children: [
          {
            type: 'value',
            fieldSpec: {
              key: 'title',
              name: 'Title',
              type: 'string',
              op: 'in',
              value: [''],
            },
          },
          {
            type: 'value',
            fieldSpec: {
              key: 'title',
              name: 'Title',
              type: 'string',
              op: 'in',
              value: [''],
            },
          },
        ],
      };

      const result = MeilisearchService.buildFilterExpression(
        mockIndex,
        filter,
      );
      // When all children are empty, we get the operator between empty strings
      expect(result).toBe('');
    });

    test('handles zero as numeric value', () => {
      const filter: SearchFilter = {
        type: 'value',
        fieldSpec: {
          key: 'duration',
          name: 'Duration',
          type: 'numeric',
          op: '=',
          value: 0,
        },
      };

      const result = MeilisearchService.buildFilterExpression(
        mockIndex,
        filter,
      );
      expect(result).toBe('duration = 0');
    });

    test('handles negative numeric values', () => {
      const filter: SearchFilter = {
        type: 'value',
        fieldSpec: {
          key: 'duration',
          name: 'Duration',
          type: 'numeric',
          op: '>',
          value: -100,
        },
      };

      const result = MeilisearchService.buildFilterExpression(
        mockIndex,
        filter,
      );
      expect(result).toBe('duration > -100');
    });
  });

  describe('real-world scenarios', () => {
    test('search for comedy or horror movies longer than 90 minutes', () => {
      const filter: SearchFilter = {
        type: 'op',
        op: 'and',
        children: [
          {
            type: 'value',
            fieldSpec: {
              key: 'type',
              name: 'Type',
              type: 'string',
              op: '=',
              value: ['movie'],
            },
          },
          {
            type: 'op',
            op: 'or',
            children: [
              {
                type: 'value',
                fieldSpec: {
                  key: 'genres.name',
                  name: 'Genre',
                  type: 'facted_string',
                  op: 'in',
                  value: ['comedy', 'horror'],
                },
              },
            ],
          },
          {
            type: 'value',
            fieldSpec: {
              key: 'duration',
              name: 'Duration',
              type: 'numeric',
              op: '>',
              value: 5400000, // 90 minutes in milliseconds
            },
          },
        ],
      };

      const result = MeilisearchService.buildFilterExpression(
        mockIndex,
        filter,
      );
      expect(result).toBe(
        "type = 'movie' AND genres.name IN ['comedy', 'horror'] AND duration > 5400000",
      );
    });

    test('search for recent TV shows with specific tags', () => {
      const filter: SearchFilter = {
        type: 'op',
        op: 'and',
        children: [
          {
            type: 'value',
            fieldSpec: {
              key: 'type',
              name: 'Type',
              type: 'string',
              op: '=',
              value: ['episode'],
            },
          },
          {
            type: 'value',
            fieldSpec: {
              key: 'originalReleaseYear',
              name: 'Release Year',
              type: 'numeric',
              op: '>=',
              value: 2020,
            },
          },
          {
            type: 'value',
            fieldSpec: {
              key: 'tags',
              name: 'Tags',
              type: 'facted_string',
              op: 'in',
              value: ['trending', 'award-winner'],
            },
          },
        ],
      };

      const result = MeilisearchService.buildFilterExpression(
        mockIndex,
        filter,
      );
      expect(result).toBe(
        "type = 'episode' AND originalReleaseYear >= 2020 AND tags IN ['trending', 'award-winner']",
      );
    });

    test('search excluding specific content', () => {
      const filter: SearchFilter = {
        type: 'op',
        op: 'and',
        children: [
          {
            type: 'value',
            fieldSpec: {
              key: 'type',
              name: 'Type',
              type: 'string',
              op: '=',
              value: ['movie'],
            },
          },
          {
            type: 'value',
            fieldSpec: {
              key: 'genres.name',
              name: 'Genre',
              type: 'facted_string',
              op: 'not in',
              value: ['horror', 'thriller'],
            },
          },
        ],
      };

      const result = MeilisearchService.buildFilterExpression(
        mockIndex,
        filter,
      );
      expect(result).toBe(
        "type = 'movie' AND genres.name NOT IN ['horror', 'thriller']",
      );
    });
  });
});
