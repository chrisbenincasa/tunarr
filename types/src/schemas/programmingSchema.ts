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
  title: z.string(),
  key: z.string(),
  ratingKey: z.string(),
  icon: z.string(),
  type: ProgramTypeSchema,
  duration: z.number(),
  summary: z.string(),
  plexFile: z.string(),
  file: z.string(),
  showTitle: z.string().optional(), // Unclear if this is necessary
  episode: z.number().optional(),
  season: z.number().optional(),
  episodeIcon: z.string().optional(),
  seasonIcon: z.string().optional(),
  showIcon: z.string().optional(),
  serverKey: z.string(),
  rating: z.string().optional(),
  date: z.string().optional(),
  year: z.number().optional(),
  channel: z.number().optional(), // Redirect
  isOffline: z.boolean(), // Flex
  customShowId: z.string().optional(),
  customShowName: z.string().optional(),
  customOrder: z.number().optional(),
});
