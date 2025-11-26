import type { Query } from '@tanstack/react-query';
import { first, intersection, isObject, isString } from 'lodash-es';
import { z } from 'zod/v4';

const queryKeySchema = z.object({
  tags: z.string().array().optional(),
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

    console.log(query.queryKey, parseResult.data.tags, tagsToMatch);

    return intersection(parseResult.data.tags, tagsToMatch).length > 0;
  };
}

export function invalidateQueryPrefix(prefix: string[]) {
  return (query: Query): boolean => {
    const key = query.queryKey;
    if (key.length < prefix.length) {
      return false;
    }

    for (let i = 0; i < prefix.length; i++) {
      const prePart = prefix[i];
      const queryPart = key[i];
      if (prePart !== queryPart) {
        return false;
      }
    }

    return true;
  };
}
