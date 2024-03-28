import { z } from 'zod';

export const PlexFilterValueNodeSchema = z.object({
  type: z.literal('value'),
  field: z.string(),
  // We should start populating this to know how to parse out the value, if necessary
  fieldType: z.string().optional(),
  op: z.string(),
  value: z.string(),
});

export type PlexFilterValueNode = {
  type: 'value';
  field: string;
  fieldType?: string;
  op: string;
  value: string;
};

export type PlexFilterOperatorNode = {
  type: 'op';
  op: 'or' | 'and';
  children: PlexFilter[];
};

// Hack to get recursive types working in zod
export const PlexFilterOperatorNodeSchema: z.ZodType<PlexFilterOperatorNode> =
  z.lazy(() =>
    z.object({
      type: z.literal('op'),
      op: z.union([z.literal('or'), z.literal('and')]),
      children: PlexFilterSchema.array(),
    }),
  );

export const PlexFilterSchema = PlexFilterOperatorNodeSchema.or(
  PlexFilterValueNodeSchema,
);

export type PlexFilter = PlexFilterOperatorNode | PlexFilterValueNode;

export const PlexSortSchema = z.object({
  field: z.string(),
  direction: z.union([z.literal('asc'), z.literal('desc')]),
});

export type PlexSort = z.infer<typeof PlexSortSchema>;

export const PlexSearchSchema = z.object({
  filter: PlexFilterSchema.optional(),
  sort: PlexSortSchema.optional(),
});

export type PlexSearch = z.infer<typeof PlexSearchSchema>;

// A PlexSearch but with a reference to the
// library it is for.
export type ScopedPlexSearch = {
  search: PlexSearch;
  libraryKey: string;
};
