import type { MediaSourceLibrary } from '@tunarr/types';
import type { SearchField } from '@tunarr/types/schemas';
import type { NonEmptyArray } from 'ts-essentials';
import type { OperatorLabelMap, Operators } from '../types/SearchBuilder.ts';

export type SearchFieldSpec<
  Typ extends SearchField['type'] = SearchField['type'],
> = {
  key: string;
  name?: string;
  type: Typ;
  displayName: string;
  uiVisible: boolean;
  visibleForLibraryTypes:
    | 'all'
    | ReadonlyArray<MediaSourceLibrary['mediaType']>;
  bijection?: Bij<ExpectedOutType<Typ>>;
  uiBijection?: Bij<ExpectedOutType<Typ>, string>;
};

export function isNumericSearchFieldSpec(
  spec: SearchFieldSpec<SearchField['type']>,
): spec is SearchFieldSpec<'numeric' | 'date'> {
  return spec.type === 'numeric' || spec.type === 'date';
}

export function isUiSearchFieldSpecOfType<Typ extends SearchField['type']>(
  spec: SearchFieldSpec<SearchField['type']>,
  typ: Typ,
): spec is SearchFieldSpec<Typ> {
  return spec.type === typ;
}

export function isFactedStringSearchFieldSpec(
  spec: SearchFieldSpec<SearchField['type']>,
): spec is SearchFieldSpec<'faceted_string'> {
  return spec.type === 'faceted_string';
}

export const numericBij: Bij<number, string> = {
  to: (n) => n.toString(),
  from: (str) => parseInt(str),
};

export const TitleSearchFieldSpec = {
  key: 'title',
  type: 'string' as const,
  displayName: 'Title',
  uiVisible: true,
  visibleForLibraryTypes: 'all',
} satisfies SearchFieldSpec<'string'>;

const MinutesField = {
  key: 'duration',
  type: 'numeric' as const,
  displayName: 'Minutes',
  name: 'minutes',
  uiVisible: true,
  visibleForLibraryTypes: 'all',
  bijection: {
    to: (mins) => mins * 60 * 1000,
    from: (ms) => ms / 60 / 1000,
  },
  uiBijection: numericBij,
} satisfies SearchFieldSpec<'numeric'>;

const SecondsField = {
  key: 'duration',
  type: 'numeric' as const,
  displayName: 'Seconds',
  name: 'seconds',
  uiVisible: true,
  visibleForLibraryTypes: 'all',
  bijection: {
    to: (sec) => sec * 1000,
    from: (ms) => ms / 1000,
  },
  uiBijection: numericBij,
} satisfies SearchFieldSpec<'numeric'>;

export const SearchFieldSpecs: NonEmptyArray<
  | SearchFieldSpec<'string' | 'faceted_string'>
  | SearchFieldSpec<'numeric' | 'date'>
> = [
  TitleSearchFieldSpec,
  {
    key: 'type',
    type: 'faceted_string' as const,
    displayName: 'Type',
    uiVisible: true,
    visibleForLibraryTypes: 'all',
  },
  {
    key: 'grandparent.title',
    name: 'show_title',
    type: 'string' as const,
    displayName: 'Show Title',
    uiVisible: true,
    visibleForLibraryTypes: ['shows'] as NoInfer<
      ReadonlyArray<MediaSourceLibrary['mediaType']>
    >,
  } satisfies SearchFieldSpec<'string'>,
  {
    key: 'genres.name',
    name: 'genre',
    type: 'faceted_string' as const,
    displayName: 'Genre',
    uiVisible: true,
    visibleForLibraryTypes: 'all',
  },
  {
    key: 'rating',
    type: 'faceted_string' as const,
    displayName: 'Content Rating',
    uiVisible: true,
    visibleForLibraryTypes: ['movies', 'shows'],
  },
  {
    key: 'actors.name',
    name: 'actor',
    type: 'faceted_string' as const,
    displayName: 'Actors',
    uiVisible: true,
    visibleForLibraryTypes: 'all',
  },
  {
    key: 'writer.name',
    name: 'writer',
    type: 'faceted_string' as const,
    displayName: 'Writers',
    uiVisible: true,
    visibleForLibraryTypes: 'all',
  },
  {
    key: 'director.name',
    name: 'director',
    type: 'faceted_string' as const,
    displayName: 'Directors',
    uiVisible: true,
    visibleForLibraryTypes: 'all',
  },
  {
    key: 'studio.name',
    name: 'studio',
    type: 'faceted_string' as const,
    displayName: 'Studios',
    uiVisible: true,
    visibleForLibraryTypes: 'all',
  },
  {
    key: 'originalReleaseDate',
    name: 'release_date',
    type: 'date' as const,
    displayName: 'Release Date',
    uiVisible: true,
    visibleForLibraryTypes: 'all',
  },
  {
    key: 'originalReleaseYear',
    name: 'year',
    type: 'numeric' as const,
    displayName: 'Release Year',
    uiVisible: true,
    visibleForLibraryTypes: 'all',
  },
  {
    key: 'videoCodec',
    name: 'video_codec',
    type: 'faceted_string' as const,
    displayName: 'Video Codec',
    uiVisible: true,
    visibleForLibraryTypes: 'all',
  },
  {
    key: 'videoHeight',
    name: 'video_height',
    type: 'numeric' as const,
    displayName: 'Video Height',
    uiVisible: true,
    visibleForLibraryTypes: 'all',
  },
  {
    key: 'videoWidth',
    name: 'video_width',
    type: 'numeric' as const,
    displayName: 'Video Width',
    uiVisible: true,
    visibleForLibraryTypes: 'all',
  },
  {
    key: 'videoBitDepth',
    name: 'video_bit_depth',
    type: 'numeric' as const,
    displayName: 'Video Bit Depth',
    uiVisible: true,
    visibleForLibraryTypes: 'all',
  },
  {
    key: 'audioCodec',
    name: 'audio_codec',
    type: 'faceted_string' as const,
    displayName: 'Audio Codec',
    uiVisible: true,
    visibleForLibraryTypes: 'all',
  },
  {
    key: 'audioChannels',
    name: 'audio_channels',
    type: 'numeric' as const,
    displayName: 'Audio Channels',
    uiVisible: true,
    visibleForLibraryTypes: 'all',
  },
  MinutesField,
  SecondsField,
  {
    key: 'tags',
    type: 'faceted_string',
    displayName: 'Tags',
    uiVisible: true,
    visibleForLibraryTypes: 'all',
  },
  {
    key: 'grandparent.tags',
    name: 'show_tags',
    type: 'faceted_string' as const,
    displayName: 'Show Tags',
    uiVisible: true,
    visibleForLibraryTypes: ['shows'] as NoInfer<
      ReadonlyArray<MediaSourceLibrary['mediaType']>
    >,
  } satisfies SearchFieldSpec<'faceted_string'>,
  {
    key: 'media_source_name',
    type: 'string' as const,
    name: 'Media Source Name',
    uiVisible: true,
    visibleForLibraryTypes: 'all',
  },
  {
    key: 'library_name',
    type: 'string' as const,
    name: 'Library Name',
    uiVisible: true,
    visibleForLibraryTypes: 'all',
  },
];

interface Bij<In, Out = In> {
  to: (input: In) => Out;
  from: (out: Out) => In;
}

type NormalizersMap = {
  [K in keyof (typeof SearchFieldSpecs)[number]['name']]: Bij<
    string,
    ExpectedOutType<(typeof SearchFieldSpecs)[K]['type']>
  >;
};

export const SearchFieldNormalizers = {
  minutes: {
    to: (mins: string): number => parseInt(mins) * 60 * 1000,
    from: (ms: number) => (ms / 60 / 1000).toString(),
  },
  seconds: {
    to: (seconds: string): number => parseInt(seconds) * 1000,
    from: (ms: number) => (ms / 1000).toString(),
  },
} satisfies Partial<NormalizersMap>;

type ExpectedOutType<Key extends SearchField['type']> = Key extends
  | 'string'
  | 'faceted_string'
  ? string
  : number;

export function normalizeField<
  Key extends keyof typeof SearchFieldSpecs,
  OutType extends ExpectedOutType<(typeof SearchFieldSpecs)[number]['type']>,
>(key: Key, value: string): OutType | null {
  if (key in SearchFieldNormalizers) {
    SearchFieldNormalizers[key as keyof typeof SearchFieldNormalizers]?.to(
      value,
    );
  }
  return null;
}

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
  faceted_string: {
    '!=': '!=',
    '=': '=',
    'starts with': 'starts with',
    contains: 'contains',
    'not contains': 'not contains',
    in: 'in',
    'not in': 'not in',
  },
  string: {
    '!=': '!=',
    '=': '=',
    'starts with': 'starts with',
    contains: 'contains',
    'not contains': 'not contains',
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
