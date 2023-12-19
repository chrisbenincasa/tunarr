import z from 'zod';

export const ProgramTypeSchema = z.union([
  z.literal('movie'),
  z.literal('episode'),
  z.literal('track'),
  z.literal('redirect'),
  z.literal('custom'),
  z.literal('flex'),
]);

export const ProgramSchema = z.object({
  channel: z.number().optional(), // Redirect
  customOrder: z.number().optional(),
  customShowId: z.string().optional(),
  customShowName: z.string().optional(),
  date: z.string().optional(),
  duration: z.number(),
  episode: z.number().optional(),
  episodeIcon: z.string().optional(),
  file: z.string().optional(),
  id: z.string(),
  icon: z.string().optional(),
  isOffline: z.boolean(), // Flex
  key: z.string().optional(),
  plexFile: z.string().optional(), // Not present on offline type
  rating: z.string().optional(),
  ratingKey: z.string().optional(), // Not present on offline type
  season: z.number().optional(),
  seasonIcon: z.string().optional(),
  serverKey: z.string().optional(),
  showIcon: z.string().optional(),
  showTitle: z.string().optional(), // Unclear if this is necessary
  summary: z.string().optional(), // Not present on offline type
  title: z.string().optional(),
  type: ProgramTypeSchema,
  year: z.number().optional(),
});
