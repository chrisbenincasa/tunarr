import z from 'zod/v4';

export const SmartCollection = z.object({
  uuid: z.uuid(),
  name: z.string(),
  query: z.string(),
});
