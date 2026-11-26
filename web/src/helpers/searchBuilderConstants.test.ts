import { search } from '@tunarr/shared/util';
import { describe, expect, test } from 'vitest';
import { SearchFieldSpecs } from './searchBuilderConstants.ts';

const textFields = SearchFieldSpecs.filter(
  (spec) => spec.type === 'string' || spec.type === 'faceted_string',
).map((spec) => spec.name ?? spec.key);

describe('SearchFieldSpecs', () => {
  test.each(textFields)('the search syntax accepts %s', (field) => {
    const lexed = search.tokenizeSearchQuery(`${field} ~ "value"`);
    expect(lexed.errors).toHaveLength(0);

    const parser = new search.SearchParser();
    parser.input = lexed.tokens;
    const query = parser.searchExpression();
    expect(parser.errors).toHaveLength(0);
    expect(
      search.searchFilterToString(search.parsedSearchToRequest(query)),
    ).toBe(`${field} ~ "value"`);
  });
});
