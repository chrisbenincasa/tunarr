import { z } from 'zod/v4';

export const PlexFilterValueNodeSchema = z.object({
  type: z.literal('value'),
  field: z.string(),
  // We should start populating this to know how to parse out the value, if necessary
  fieldType: z.string().optional(),
  op: z.string(),
  value: z.string(),
});

export type PlexFilterValueNode = z.infer<typeof PlexFilterValueNodeSchema>;

export const PlexFilterOperatorNodeSchema = z.object({
  type: z.literal('op'),
  op: z.union([z.literal('or'), z.literal('and')]),
  get children(): z.ZodArray<
    z.ZodDiscriminatedUnion<
      [typeof PlexFilterOperatorNodeSchema, typeof PlexFilterValueNodeSchema]
    >
  > {
    return z.array(PlexFilterSchema);
  },
});

export type PlexFilterOperatorNode = z.infer<
  typeof PlexFilterOperatorNodeSchema
>;

export const PlexFilterSchema: z.ZodDiscriminatedUnion<
  [typeof PlexFilterOperatorNodeSchema, typeof PlexFilterValueNodeSchema]
> = z.discriminatedUnion('type', [
  PlexFilterOperatorNodeSchema,
  PlexFilterValueNodeSchema,
]);

export type PlexFilter = z.infer<typeof PlexFilterSchema>;

export const PlexSortSchema = z.object({
  field: z.string(),
  direction: z.union([z.literal('asc'), z.literal('desc')]),
});

export type PlexSort = z.infer<typeof PlexSortSchema>;

export const PlexSearchSchema = z.object({
  filter: PlexFilterSchema.optional(),
  sort: PlexSortSchema.optional(),
  limit: z.number().nonnegative().optional().catch(undefined),
});

export type PlexSearch = z.infer<typeof PlexSearchSchema>;

// A PlexSearch but with a reference to the
// library it is for.
export type ScopedPlexSearch = {
  search: PlexSearch;
  libraryKey: string;
};

z.globalRegistry.add(PlexFilterSchema, { id: 'PlexFilter' });
