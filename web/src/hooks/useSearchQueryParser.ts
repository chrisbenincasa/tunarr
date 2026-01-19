import { search } from '@tunarr/shared/util';
import { isEmpty } from 'lodash-es';

const parser = new search.SearchParser();

export function tokenize(input: string) {
  return search.tokenizeSearchQuery(input);
}

export function parseSearchQuery(input: string) {
  if (isEmpty(input)) {
    return;
  }

  const lexerResult = tokenize(input);
  if (!isEmpty(lexerResult.errors)) {
    lexerResult.errors.forEach((err) => console.error(err));
    return { type: 'error' as const, errors: lexerResult.errors };
  }

  parser.reset();
  parser.input = lexerResult.tokens;
  const query = parser.searchExpression();
  if (parser.errors.length > 0) {
    return {
      type: 'error' as const,
      errors: parser.errors,
    };
  }

  // This isn't totally true...
  return {
    type: 'success' as const,
    query,
  };
}

export function parseSearchQueryOrNull(input: string) {
  const result = parseSearchQuery(input);
  if (!result || result?.type === 'error') {
    return null;
  }
  return result.query;
}

export function parseToSearchFilterOrNull(input: string) {
  const parsed = parseSearchQueryOrNull(input);
  if (!parsed) return null;
  return search.parsedSearchToRequest(parsed);
}

export const useSearchQueryParser = () => {
  return {
    parser,
    tokenize,
    getSearchExpression: parseSearchQuery,
    getSearchExpressionOrNull: parseSearchQueryOrNull,
    parseToSearchFilterOrNull,
  };
};
