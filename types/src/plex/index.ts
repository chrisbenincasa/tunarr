import z from 'zod';

export const PlexLibrarySectionSchema = z.object({
  allowSync: z.boolean(),
  art: z.string(),
  composite: z.string(),
  filters: z.boolean(),
  refreshing: z.boolean(),
  thumb: z.string(),
  key: z.string(),
  type: z.string(),
  title: z.string(),
  agent: z.string(),
  scanner: z.string(),
  language: z.string(),
  uuid: z.string(),
  updatedAt: z.number(),
  createdAt: z.number(),
  scannedAt: z.number(),
  content: z.boolean(),
  directory: z.boolean(),
  contentChangedAt: z.number(),
  hidden: z.number().transform((n) => n === 1),
  Location: z.array(z.object({ id: z.number(), path: z.string() })),
});

export const PlexLibrarySectionsSchema = z.object({
  size: z.number(),
  title1: z.string(),
  Directory: z.array(PlexLibrarySectionSchema),
});

export type PlexLibrarySection = z.infer<typeof PlexLibrarySectionSchema>;

export type PlexLibrarySections = z.infer<typeof PlexLibrarySectionsSchema>;
