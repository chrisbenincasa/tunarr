import { z } from 'zod/v4';
import { ContentProgramSchema, CustomProgramSchema } from './lineupPrograms.js';

export const CustomShowProgrammingSchema = z.array(
  z.discriminatedUnion('type', [ContentProgramSchema, CustomProgramSchema]),
);

export const CustomShowSyncMediaSourceTypeSchema = z.enum(['plex']);

export const CustomShowSchema = z.object({
  id: z.string(),
  name: z.string(),
  contentCount: z.number(),
  programs: z.array(CustomProgramSchema).optional(),
  totalDuration: z.number().nonnegative(),
  syncMediaSourceId: z.string().nullish(),
  syncMediaSourceType: CustomShowSyncMediaSourceTypeSchema.nullish(),
  syncExternalPlaylistId: z.string().nullish(),
  lastSyncedAt: z.number().nullish(),
  isSyncing: z.boolean().default(false),
});
