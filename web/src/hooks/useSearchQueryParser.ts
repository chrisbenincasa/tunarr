import { search } from '@tunarr/shared/util';
import { isEmpty } from 'lodash-es';
import { useCallback, useMemo } from 'react';
export const useSearchQueryParser = () => {
  const parser = useMemo(() => new search.SearchParser(), []);

  const parse = useCallback((input: string) => {
    return search.parseSearchQuery(input);
  }, []);

  const getSearchExpression = useCallback(
    (input: string) => {
      if (isEmpty(input)) {
        return;
      }

      const lexerResult = parse(input);
      if (!isEmpty(lexerResult.errors)) {
        return { type: 'error' as const, errors: lexerResult.errors };
      }

      parser.input = lexerResult.tokens;
      // This isn't totally true...
      return {
        type: 'success' as const,
        query: parser.searchExpression(),
      };
    },
    [parse, parser],
  );

  return {
    parser,
    parse,
    getSearchExpression,
  };
};
