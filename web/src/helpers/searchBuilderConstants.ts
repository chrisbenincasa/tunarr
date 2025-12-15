import type { MediaSourceLibrary } from '@tunarr/types';
import type { SearchField } from '@tunarr/types/api';
import dayjs from 'dayjs';
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

export const SearchFieldSpecs: Record<
  string,
  | SearchFieldSpec<'string' | 'facted_string'>
  | SearchFieldSpec<'numeric' | 'date'>
> = {
  title: {
    key: 'title',
    type: 'string' as const,
    name: 'Title',
    uiVisible: true,
    visibleForLibraryTypes: 'all',
  } satisfies SearchFieldSpec<'string'>,
  'grandparent.title': {
    key: 'grandparent.title',
    type: 'string' as const,
    name: 'Show Title',
    uiVisible: true,
    visibleForLibraryTypes: ['shows'] as NoInfer<
      ReadonlyArray<MediaSourceLibrary['mediaType']>
    >,
  } satisfies SearchFieldSpec<'string'>,
  'genres.name': {
    key: 'genres.name',
    type: 'facted_string' as const,
    name: 'Genre',
    uiVisible: true,
    visibleForLibraryTypes: 'all',
  },
  rating: {
    key: 'rating',
    type: 'facted_string' as const,
    name: 'Content Rating',
    uiVisible: true,
    visibleForLibraryTypes: ['movies', 'shows'],
  },
  'actors.name': {
    key: 'actors.name',
    type: 'facted_string' as const,
    name: 'Actors',
    uiVisible: true,
    visibleForLibraryTypes: 'all',
  },
  originalReleaseDate: {
    key: 'originalReleaseDate',
    type: 'date' as const,
    name: 'Release Date',
    uiVisible: true,
    visibleForLibraryTypes: 'all',
  },
  minutes: MinutesField,
};

function normalizeReleaseDate(value: string) {
  for (const format of ['YYYY-MM-DD', 'YYYYMMDD']) {
    const d = dayjs(value, format, true);
    if (d.isValid()) {
      return +d;
    }
  }
  throw new Error(`Could not parse inputted date string: ${value}`);
}

interface Bij<In, Out = In> {
  to: (input: In) => Out;
  from: (out: Out) => In;
}

// const numericFieldNormalizersByField = {
//   minutes: (mins: number) => mins * 60 * 1000,
//   seconds: (secs: number) => secs * 1000,
// } satisfies Record<string, Converter<number>>;

// const dateFieldNormalizersByField = {
//   release_date: normalizeReleaseDate,
// } satisfies Record<string, Converter<string, number>>;

type NormalizersMap = {
  [K in keyof typeof SearchFieldSpecs]: Bij<
    string,
    ExpectedOutType<(typeof SearchFieldSpecs)[K]['type']>
  >;
};

export const SearchFieldNormalizers = {
  minutes: {
    to: (mins: string): number => parseInt(mins) * 60 * 1000,
    from: (ms: number) => (ms / 60 / 1000).toString(),
  },
} satisfies Partial<NormalizersMap>;

type ExpectedOutType<Key extends SearchField['type']> = Key extends
  | 'string'
  | 'faceted_string'
  ? string
  : number;

export function normalizeField<
  Key extends keyof typeof SearchFieldSpecs,
  OutType extends ExpectedOutType<(typeof SearchFieldSpecs)[Key]['type']>,
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
