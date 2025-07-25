import type { PlexFilter, PlexSort } from '@tunarr/types/api';
import { isUndefined } from 'lodash-es';

// Commenting this out for now because it breaks the build but we will need it
// later.
//const PlexFilterFieldPattern = /(?:([a-zA-Z]*)\.)?([a-zA-Z]+)([!<>=&]*)/;

// TODO make this a hook
export function buildPlexFilterKey(query: PlexFilter | undefined): string[] {
  if (isUndefined(query)) {
    return [];
  }

  const filters: string[] = [];
  switch (query.type) {
    case 'op': {
      if (query.children.length === 0) {
        break; // Ignore this node for now
      } else if (query.children.length === 1) {
        filters.push(...buildPlexFilterKey(query.children[0]));
      } else {
        filters.push('push=1');
        for (let index = 0; index < query.children.length; index++) {
          const child = query.children[index];
          filters.push(...buildPlexFilterKey(child));
          if (index < query.children.length - 1) {
            filters.push(`${query.op}=1`);
          }
        }
        filters.push('pop=1');
      }
      break;
    }

    case 'value': {
      // Need to validate
      const operator = query.op.substring(0, query.op.length - 1);
      filters.push(`${query.field}${operator}=${query.value}`);
      break;
    }
  }

  return filters;
}

export function buildPlexSortKey(sort: PlexSort | undefined): string[] {
  if (isUndefined(sort)) {
    return [];
  }

  let key: string;
  if (sort.direction === 'asc') {
    key = sort.field;
  } else {
    key = `${sort.field}:desc`;
  }

  return ['sort=' + key];
}
