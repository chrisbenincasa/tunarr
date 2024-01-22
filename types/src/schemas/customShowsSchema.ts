import { z } from 'zod';

export const CustomShowSchema = z.object({
  id: z.string(),
  name: z.string(),
  contentCount: z.number(),
});
