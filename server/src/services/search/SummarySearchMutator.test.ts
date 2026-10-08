import type {
  SearchFilter,
  SearchFilterValueNode,
  StringOperators,
} from '@tunarr/types/schemas';
import { describe, expect, test } from 'vitest';
import { MeilisearchService } from '../MeilisearchService.ts';
import { SummarySearchMutator } from './SummarySearchMutator.ts';

const index = {
  name: 'programs',
  primaryKey: 'id',
  filterable: ['summary', 'plot', 'type'],
  sortable: [],
};

const summaryNode = (
  op: StringOperators,
  value: string[] = ['halloween'],
): SearchFilterValueNode => ({
  type: 'value',
  fieldSpec: { key: 'summary', name: 'summary', type: 'string', op, value },
});

describe('SummarySearchMutator', () => {
  const mutator = new SummarySearchMutator();

  test('applies only to the summary string field', () => {
    expect(mutator.appliesTo(summaryNode('contains'))).toBe(true);
    expect(
      mutator.appliesTo({
        type: 'value',
        fieldSpec: {
          key: 'title',
          name: 'title',
          type: 'string',
          op: 'contains',
          value: ['halloween'],
        },
      }),
    ).toBe(false);
  });

  test.each<StringOperators>(['contains', '=', 'in', 'starts with'])(
    'matches summary or plot for %s',
    (op) => {
      const result = mutator.mutate(summaryNode(op));

      expect(result).toMatchObject({
        type: 'op',
        op: 'or',
        children: [
          { fieldSpec: { key: 'summary', op } },
          { fieldSpec: { key: 'plot', op } },
        ],
      });
    },
  );

  test.each<StringOperators>(['not contains', '!=', 'not in'])(
    'excludes matches in both summary and plot for %s',
    (op) => {
      const result = mutator.mutate(summaryNode(op));

      expect(result).toMatchObject({ type: 'op', op: 'and' });
    },
  );

  test('builds a parenthesized Meilisearch filter when nested', () => {
    const filter: SearchFilter = {
      type: 'op',
      op: 'and',
      children: [
        mutator.mutate(summaryNode('contains')),
        {
          type: 'value',
          fieldSpec: {
            key: 'type',
            name: 'type',
            type: 'string',
            op: '=',
            value: ['movie'],
          },
        },
      ],
    };

    expect(MeilisearchService.buildFilterExpression(index, filter)).toBe(
      "(summary CONTAINS 'halloween' OR plot CONTAINS 'halloween') AND type = 'movie'",
    );
  });
});
