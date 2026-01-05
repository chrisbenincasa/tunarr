import type { MediaSourceLibrary } from '@tunarr/types';
import type { SearchField } from '@tunarr/types/api';
import type { NonEmptyArray } from 'ts-essentials';
import type { OperatorLabelMap, Operators } from '../types/SearchBuilder.ts';

export type SearchFieldSpec<Typ extends SearchField['type']> = {
  key: string;
  type: Typ;
  name: string;
  uiVisible: boolean;
  alias?: string;
  visibleForLibraryTypes:
    | 'all'
    | ReadonlyArray<MediaSourceLibrary['mediaType']>;
  normalizer?: (input: string) => ExpectedOutType<Typ>;
  uiFormatter?: (input: ExpectedOutType<Typ>) => string;
};

export const TitleSearchFieldSpec = {
  key: 'title',
  type: 'string' as const,
  name: 'Title',
  uiVisible: true,
  visibleForLibraryTypes: 'all',
} satisfies SearchFieldSpec<'string'>;

const MinutesField = {
  key: 'duration',
  type: 'numeric' as const,
  name: 'Minutes',
  alias: 'minutes',
  uiVisible: true,
  visibleForLibraryTypes: 'all',
  normalizer: (input) => parseInt(input) * 60 * 1000,
  uiFormatter: (input) => (input / 60 / 1000).toString(),
} satisfies SearchFieldSpec<'numeric'>;

const SecondsField = {
  key: 'duration',
  type: 'numeric' as const,
  name: 'Seconds',
  alias: 'seconds',
  uiVisible: true,
  visibleForLibraryTypes: 'all',
  normalizer: (input) => parseInt(input) * 1000,
  uiFormatter: (input) => (input / 1000).toString(),
} satisfies SearchFieldSpec<'numeric'>;

export const SearchFieldSpecs: NonEmptyArray<
  | SearchFieldSpec<'string' | 'facted_string'>
  | SearchFieldSpec<'numeric' | 'date'>
> = [
  TitleSearchFieldSpec,
  {
    key: 'type',
    type: 'facted_string' as const,
    name: 'Type',
    uiVisible: true,
    visibleForLibraryTypes: 'all',
  },
  {
    key: 'grandparent.title',
    alias: 'show_title',
    type: 'string' as const,
    name: 'Show Title',
    uiVisible: true,
    visibleForLibraryTypes: ['shows'] as NoInfer<
      ReadonlyArray<MediaSourceLibrary['mediaType']>
    >,
  } satisfies SearchFieldSpec<'string'>,
  {
    key: 'genres.name',
    alias: 'genre',
    type: 'facted_string' as const,
    name: 'Genre',
    uiVisible: true,
    visibleForLibraryTypes: 'all',
  },
  {
    key: 'rating',
    type: 'facted_string' as const,
    name: 'Content Rating',
    uiVisible: true,
    visibleForLibraryTypes: ['movies', 'shows'],
  },
  {
    key: 'actors.name',
    alias: 'actor',
    type: 'facted_string' as const,
    name: 'Actors',
    uiVisible: true,
    visibleForLibraryTypes: 'all',
  },
  {
    key: 'writer.name',
    alias: 'writer',
    type: 'facted_string' as const,
    name: 'Writers',
    uiVisible: true,
    visibleForLibraryTypes: 'all',
  },
  {
    key: 'director.name',
    alias: 'director',
    type: 'facted_string' as const,
    name: 'Directors',
    uiVisible: true,
    visibleForLibraryTypes: 'all',
  },
  {
    key: 'studio.name',
    alias: 'studio',
    type: 'facted_string' as const,
    name: 'Studios',
    uiVisible: true,
    visibleForLibraryTypes: 'all',
  },
  {
    key: 'originalReleaseDate',
    alias: 'release_date',
    type: 'date' as const,
    name: 'Release Date',
    uiVisible: true,
    visibleForLibraryTypes: 'all',
  },
  {
    key: 'originalReleaseYear',
    alias: 'year',
    type: 'numeric' as const,
    name: 'Release Year',
    uiVisible: true,
    visibleForLibraryTypes: 'all',
  },
  {
    key: 'videoCodec',
    alias: 'video_codec',
    type: 'facted_string' as const,
    name: 'Video Codec',
    uiVisible: true,
    visibleForLibraryTypes: 'all',
  },
  {
    key: 'videoHeight',
    alias: 'video_height',
    type: 'numeric' as const,
    name: 'Video Height',
    uiVisible: true,
    visibleForLibraryTypes: 'all',
  },
  {
    key: 'videoWidth',
    alias: 'video_width',
    type: 'numeric' as const,
    name: 'Video Width',
    uiVisible: true,
    visibleForLibraryTypes: 'all',
  },
  {
    key: 'videoBitDepth',
    alias: 'video_bit_depth',
    type: 'numeric' as const,
    name: 'Video Bit Depth',
    uiVisible: true,
    visibleForLibraryTypes: 'all',
  },
  {
    key: 'audioCodec',
    alias: 'audio_codec',
    type: 'facted_string' as const,
    name: 'Audio Codec',
    uiVisible: true,
    visibleForLibraryTypes: 'all',
  },
  {
    key: 'audioChannels',
    alias: 'audio_channels',
    type: 'numeric' as const,
    name: 'Audio Channels',
    uiVisible: true,
    visibleForLibraryTypes: 'all',
  },
  MinutesField,
  SecondsField,
];

interface Bij<In, Out = In> {
  to: (input: In) => Out;
  from: (out: Out) => In;
}

type NormalizersMap = {
  [K in keyof (typeof SearchFieldSpecs)[number]['alias']]: Bij<
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
