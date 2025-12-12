import type { MediaSourceLibrary } from '@tunarr/types';
import type { SearchField } from '@tunarr/types/api';
import type { OperatorLabelMap, Operators } from '../types/SearchBuilder.ts';

export type SearchFieldSpec<Key extends string = string> = {
  key: Key;
  type: SearchField['type'];
  name: string;
  uiVisible: boolean;
  visibleForLibraryTypes:
    | 'all'
    | ReadonlyArray<MediaSourceLibrary['mediaType']>;
};

// The supported fields for searching and filtering
type SearchFieldSpecMapping = {
  [K in SearchFieldSpec['key']]: SearchFieldSpec<K>;
};

export const SearchFieldSpec = {
  title: {
    key: 'title',
    type: 'string',
    name: 'Title',
    uiVisible: true,
    visibleForLibraryTypes: 'all',
  } satisfies SearchFieldSpec,

  'grandparent.title': {
    key: 'grandparent.title',
    type: 'string',
    name: 'Show Title',
    uiVisible: true,
    visibleForLibraryTypes: ['shows'] as NoInfer<
      ReadonlyArray<MediaSourceLibrary['mediaType']>
    >,
  },
  'genres.name': {
    key: 'genres.name',
    type: 'facted_string',
    name: 'Genre',
    uiVisible: true,
    visibleForLibraryTypes: 'all',
  },
  rating: {
    key: 'rating',
    type: 'facted_string',
    name: 'Content Rating',
    uiVisible: true,
    visibleForLibraryTypes: ['movies', 'shows'],
  },
  'actors.name': {
    key: 'actors.name',
    type: 'facted_string',
    name: 'Actors',
    uiVisible: true,
    visibleForLibraryTypes: 'all',
  },
  originalReleaseDate: {
    key: 'originalReleaseDate',
    type: 'date',
    name: 'Release Date',
    uiVisible: true,
    visibleForLibraryTypes: 'all',
  },
} satisfies SearchFieldSpecMapping;

const OperatorLabelByFieldType = {
  date: {
    '!=': '!=',
    '<': 'before',
    '<=': 'on or before',
    '=': '=',
    '>': 'after',
    '>=': 'on or after',
    to: 'between',
  },
  numeric: {
    '!=': '!=',
    '<': 'less than',
    '<=': 'less than or equal',
    '=': '=',
    '>': 'greater than',
    '>=': 'greater than or equal',
    to: 'between',
  },
  facted_string: {
    '!=': '!=',
    '=': '=',
    'starts with': 'starts with',
    contains: 'contains',
    in: 'in',
    'not in': 'not in',
  },
  string: {
    '!=': '!=',
    '=': '=',
    'starts with': 'starts with',
    contains: 'contains',
    in: 'in',
    'not in': 'not in',
  },
} satisfies OperatorLabelMap;

export function getOperatorLabel<Type extends SearchField['type']>(
  fieldType: Type,
  op: Operators<Type>,
) {
  const x = OperatorLabelByFieldType[fieldType] as Record<
    Operators<Type>,
    string
  >;
  return x[op];
}
