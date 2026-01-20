import z from 'zod/v4';
import { SearchFilterQuerySchema } from './SearchRequest.js';

export const SmartCollection = z.object({
  uuid: z.uuid(),
  name: z.string(),
  // filter: z.string(),
  filter: SearchFilterQuerySchema.optional(),
  keywords: z.string(),
});
