import type { Query } from '@tanstack/react-query';
import { first, intersection } from 'lodash-es';
import { z } from 'zod/v4';

const queryKeySchema = z.object({
  tags: z.string().array(),
});

export function invalidateTaggedQueries(tagsToMatch: string[]) {
  return (query: Query): boolean => {
    if (tagsToMatch.length === 0) {
      return false;
    }

    const key = first(query.queryKey);
    if (!key) {
      return false;
    }

    try {
      const { tags } = queryKeySchema.parse(key);
      return intersection(tags, tagsToMatch).length > 0;
    } catch (e) {
      console.warn(e);
      return false;
    }
  };
}
