// API types

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
// A PlexSearch but with a reference to the
// library it is for.
export type ScopedPlexSearch = {
  search: PlexSearch;
  libraryKey: string;
};
