import { z } from 'zod/v4';
import type { MediaSourceLibrary } from '../MediaSourceSettings.js';
import type { TupleToUnion } from '../util.js';

const StringOperators = [
  '=',
  '!=',
  'contains',
  'starts with',
  'in',
  'not in',
] as const;
export type StringOperators = TupleToUnion<typeof StringOperators>;

const NumericOperators = ['=', '!=', '<', '>', '<=', '>=', 'to'] as const;
export type NumericOperators = TupleToUnion<typeof NumericOperators>;

const StringSearchFieldSchema = z.object({
  key: z.string(),
  name: z.string(),
  type: z.literal('string'),
  op: z.enum(StringOperators),
  value: z.string().array(),
});

const FactedStringSearchFieldSchema = z.object({
  ...StringSearchFieldSchema.shape,
  type: z.literal('facted_string'),
});

export type FactedStringSearchField = z.infer<
  typeof FactedStringSearchFieldSchema
>;

const NumericSearchFieldSchema = z.object({
  key: z.string(),
  name: z.string(),
  type: z.literal('numeric'),
  op: z.enum(NumericOperators),
  // Is this weird
  value: z.number().or(z.tuple([z.number(), z.number()])),
});

const DateSearchFieldSchema = z.object({
  ...NumericSearchFieldSchema.shape,
  type: z.literal('date'),
});

export type DateSearchField = z.infer<typeof DateSearchFieldSchema>;

export const SearchFieldSchema = z.discriminatedUnion('type', [
  StringSearchFieldSchema,
  FactedStringSearchFieldSchema,
  NumericSearchFieldSchema,
  DateSearchFieldSchema,
]);

export type SearchField = z.infer<typeof SearchFieldSchema>;

export type SearchFieldType = SearchField['type'];

export const OperatorsByType = {
  string: StringOperators,
  numeric: NumericOperators,
  date: NumericOperators,
  facted_string: StringOperators,
} satisfies Record<SearchField['type'], ReadonlyArray<string>>;

export const SearchFilterValueNodeSchema = z.object({
  type: z.literal('value'),
  fieldSpec: SearchFieldSchema,
});

export type SearchFilterValueNode = {
  type: 'value';
  fieldSpec: SearchField;
};

export type SearchFilterOperatorNode = {
  type: 'op';
  op: 'or' | 'and';
  children: SearchFilter[];
};

// Hack to get recursive types working in zod
export const SearchFilterOperatorNodeSchema = z.object({
  type: z.literal('op'),
  op: z.enum(['or', 'and']),
  get children(): z.ZodArray<
    z.ZodDiscriminatedUnion<
      [
        typeof SearchFilterOperatorNodeSchema,
        typeof SearchFilterValueNodeSchema,
      ]
    >
  > {
    return SearchFilterQuerySchema.array();
  },
});

export const SearchFilterQuerySchema: z.ZodDiscriminatedUnion<
  [typeof SearchFilterOperatorNodeSchema, typeof SearchFilterValueNodeSchema]
> = z.discriminatedUnion('type', [
  SearchFilterOperatorNodeSchema,
  SearchFilterValueNodeSchema,
]);

export type SearchFilter = z.infer<typeof SearchFilterQuerySchema>;

export const SearchSortSchema = z.object({
  field: z.string(),
  direction: z.enum(['asc', 'desc']),
});

export type SearchSort = z.infer<typeof SearchSortSchema>;

export const SearchRequestSchema = z.object({
  query: z.string().nullish(),
  restrictSearchTo: z.string().array().optional(),
  filter: SearchFilterQuerySchema.nullish(),
  sort: SearchSortSchema.nullish(),
});

export type SearchRequest = z.infer<typeof SearchRequestSchema>;

// A PlexSearch but with a reference to the
// library it is for.
export type LibrarySearchRequest = {
  search: SearchRequest;
  libraryId: string;
};

export type SearchFieldSpec<Key extends string = string> = {
  key: Key;
  type: SearchField['type'];
  name: string;
  visibleForLibraryTypes:
    | 'all'
    | ReadonlyArray<MediaSourceLibrary['mediaType']>;
};

z.globalRegistry.add(SearchFilterQuerySchema, { id: 'SearchFilter' });
