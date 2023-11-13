import z from 'zod';

export const ResolutionSchema = z.object({
  widthPx: z.number(),
  heightPx: z.number(),
});
