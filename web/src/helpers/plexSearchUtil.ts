import { isUndefined } from 'lodash-es';

const PlexFilterFieldPattern = /(?:([a-zA-Z]*)\.)?([a-zA-Z]+)([!<>=&]*)/;

export type PlexFilterValueNode = {
  type: 'value';
  field: string;
  op: string;
  value: string;
};

export type PlexFilterAndNode = {
  type: 'op';
  op: 'and';
  children: PlexFilter[];
};

export type PlexFilterOrNode = {
  type: 'op';
  op: 'or';
  children: PlexFilter[];
};

export type PlexFilterOperatorNode = PlexFilterAndNode | PlexFilterOrNode;
export type PlexFilter = PlexFilterOperatorNode | PlexFilterValueNode;
export type PlexSort = { field: string; direction: 'asc' | 'desc' };
export type PlexSearch = {
  filter?: PlexFilter;
  sort?: PlexSort;
};

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
        for (const child of query.children) {
          filters.push(...buildPlexFilterKey(child));
          filters.push(`${query.op}=1`);
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
