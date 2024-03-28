import { z } from 'zod';

export const PlexFilterValueNodeSchema = z.object({
  type: z.literal('value'),
  field: z.string(),
  // We should start populating this to know how to parse out the value, if necessary
  fieldType: z.string().optional(),
  op: z.string(),
  value: z.string(),
});

export type PlexFilterValueNode = z.infer<typeof PlexFilterValueNodeSchema>;

const baseFilterOperatorNodeSchema = z.object({
  type: z.literal('op'),
  op: z.union([z.literal('or'), z.literal('and')]),
});

export type PlexFilterOperatorNode = z.infer<
  typeof baseFilterOperatorNodeSchema
> & {
  children: PlexFilter[];
};

// Some hacks to get recursive types working with Zod. z.switch can't come soon enough!
export const PlexFilterOperatorNodeSchema: z.ZodDiscriminatedUnionOption<'type'> =
  baseFilterOperatorNodeSchema.extend({
    children: z.lazy(() => PlexFilterSchema.array()),
  });

export const PlexFilterSchema = z.discriminatedUnion('type', [
  PlexFilterValueNodeSchema,
  PlexFilterOperatorNodeSchema,
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
});

export type PlexSearch = z.infer<typeof PlexSearchSchema>;

// A PlexSearch but with a reference to the
// library it is for.
export type ScopedPlexSearch = {
  search: PlexSearch;
  libraryKey: string;
};
