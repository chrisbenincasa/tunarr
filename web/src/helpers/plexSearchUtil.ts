const PlexFilterFieldPattern = /(?:([a-zA-Z]*)\.)?([a-zA-Z]+)([!<>=&]*)/;

export type PlexQueryValueNode = {
  type: 'value';
  field: string;
  op: string;
  value: string;
};

export type PlexAndNode = {
  type: 'op';
  op: 'and';
  children: PlexQuery[];
};

export type PlexOrNode = {
  type: 'op';
  op: 'or';
  children: PlexQuery[];
};

export type PlexOpNode = PlexAndNode | PlexOrNode;
export type PlexQuery = PlexOpNode | PlexQueryValueNode;

// These work for strings...verify other ones
const operatorToParam: Record<string, string> = {
  '=': '',
  '!=': '!',
  '==': '=',
  '!==': '!=',
  '<=': '<',
  '>=': '>',
};

// TODO make this a hook
export function buildSearchKey(query: PlexQuery): string[] {
  const filters: string[] = [];
  switch (query.type) {
    case 'op': {
      if (query.children.length === 1) {
        filters.push(...buildSearchKey(query.children[0]));
      } else {
        filters.push('push=1');
        for (const child of query.children) {
          filters.push(...buildSearchKey(child));
          filters.push(`${query.op}=1`);
        }
        filters.push('pop=1');
      }
      break;
    }

    case 'value': {
      // Need to validate
      const operator = operatorToParam[query.op] ?? query.op;
      // filters.push(
      //   `${encodeURIComponent(
      //     `${query.field}${operator}`,
      //   )}=${encodeURIComponent(query.value)}`,
      // );
      console.log(operator, query.field);
      filters.push(`${query.field}${operator}=${query.value}`);
      break;
    }
  }

  return filters;
}
