import { z } from 'zod';
export const ChannelIconSchema = z.object({
  path: z.string(),
  width: z.number(),
  duration: z.number(),
  position: z.string(),
});
