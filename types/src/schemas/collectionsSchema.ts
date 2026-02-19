import z from 'zod/v4';
import { SearchFilterQuerySchema } from './SearchRequest.js';

export const SmartCollection = z.object({
  uuid: z.uuid(),
  name: z.string(),
  filter: SearchFilterQuerySchema.optional(),
  filterString: z.string().optional(),
  keywords: z.string(),
});
