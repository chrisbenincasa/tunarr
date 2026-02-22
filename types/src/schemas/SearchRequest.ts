import { z } from 'zod/v4';
import type { TupleToUnion } from '../util.js';

const StringOperators = [
  '=',
  '!=',
  'contains',
  'not contains',
  'starts with',
  'in',
  'not in',
] as const;
export type StringOperators = TupleToUnion<typeof StringOperators>;

const NumericOperators = ['=', '!=', '<', '>', '<=', '>=', 'to'] as const;

export type NumericOperators = TupleToUnion<typeof NumericOperators>;

const BaseSearchFieldSchema = z.object({
  key: z.string().describe('The actual field path in the search index'),
  name: z
    .string()
    .optional()
    .describe('The field name. This could be an alias.'),
});

const StringSearchFieldSchema = z.object({
  ...BaseSearchFieldSchema.shape,
  type: z.literal('string'),
  op: z.enum(StringOperators),
  value: z.string().array(),
});

export type StringSearchField = z.infer<typeof StringSearchFieldSchema>;

const FactedStringSearchFieldSchema = z.object({
  ...StringSearchFieldSchema.shape,
  type: z.literal('faceted_string'),
});

export type FactedStringSearchField = z.infer<
  typeof FactedStringSearchFieldSchema
>;

const NumericSearchFieldSchema = z.object({
  ...BaseSearchFieldSchema.shape,
  type: z.literal('numeric'),
  op: z.enum(NumericOperators),
  // Is this weird
  value: z.number().or(z.tuple([z.number(), z.number()])),
});

export type NumericSearchField = z.infer<typeof NumericSearchFieldSchema>;

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
  faceted_string: StringOperators,
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
  // When true, this node was explicitly parenthesized in the original query
  grouped?: boolean;
};
// Hack to get recursive types working in zod

export const SearchFilterOperatorNodeSchema = z.object({
  type: z.literal('op'),
  op: z.enum(['or', 'and']),
  grouped: z.boolean().optional(),
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

export const SearchSortFields = [
  'title',
  'sortTitle',
  'duration',
  'originalReleaseDate',
  'originalReleaseYear',
  'index',
] as const;

export type SearchSortField = TupleToUnion<typeof SearchSortFields>;

export const SearchSortSchema = z.object({
  field: z.enum(SearchSortFields),
  direction: z.enum(['asc', 'desc']),
});

export type SearchSort = z.infer<typeof SearchSortSchema>;

export const SearchRequestSchema = z.object({
  query: z.string().nullish(),
  restrictSearchTo: z.string().array().optional(),
  filter: SearchFilterQuerySchema.nullish(),
  sort: SearchSortSchema.array().nullish(),
});

export type SearchRequest = z.infer<typeof SearchRequestSchema>;

export function isSearchFieldSpecOfType<Typ extends SearchField['type']>(
  spec: SearchField,
  type: Typ,
): spec is Extract<SearchField, { type: Typ }> {
  return spec.type === type;
}
