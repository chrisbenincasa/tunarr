import { search } from '@tunarr/shared/util';
import { describe, expect, test } from 'vitest';
import { SearchFieldSpecs } from './searchBuilderConstants.ts';

const textFields = SearchFieldSpecs.filter(
  (spec) => spec.type === 'string' || spec.type === 'faceted_string',
).map((spec) => spec.name ?? spec.key);

const facetedFields = SearchFieldSpecs.filter(
  (spec) => spec.type === 'faceted_string',
);

function indexFieldOf(field: string) {
  return search.virtualFieldToIndexField[field] ?? field;
}

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

  test.each(['audio_language', 'subtitle_language'])(
    'the builder offers %s with value suggestions',
    (field) => {
      const spec = facetedFields.find((spec) => spec.name === field);
      expect(spec?.uiVisible).toBe(true);
    },
  );

  // The value dropdown looks up suggestions by the spec's key, so the key has
  // to name the same index field the filter uses.
  test.each(facetedFields.map((spec) => [spec.name ?? spec.key, spec.key]))(
    'suggestions for %s come from the field it filters on',
    (field, key) => {
      expect(indexFieldOf(key)).toBe(indexFieldOf(field));
    },
  );
});
