import type { Query } from '@tanstack/react-query';
import { first, intersection, isObject, isString } from 'lodash-es';
import { z } from 'zod/v4';

const queryKeySchema = z.object({
  tags: z.string().array(),
});

export function invalidateTaggedQueries(tagsToMatch: string | string[]) {
  return (query: Query): boolean => {
    tagsToMatch = isString(tagsToMatch) ? [tagsToMatch] : tagsToMatch;
    if (tagsToMatch.length === 0) {
      return false;
    }

    const key = first(query.queryKey);
    if (!key) {
      return false;
    }

    if (!isObject(key)) {
      return false;
    }

    const parseResult = queryKeySchema.safeParse(key);
    if (parseResult.error) {
      console.warn(z.prettifyError(parseResult.error), key, query.queryKey);
      return false;
    }

    return intersection(parseResult.data.tags, tagsToMatch).length > 0;
  };
}
