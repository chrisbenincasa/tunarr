import z from 'zod';

export const ResolutionSchema = z.object({
  widthPx: z.number(),
  heightPx: z.number(),
});

export const HealthCheckSchema = z.union([
  z.object({ type: z.literal('healthy') }),
  z.object({
    type: z.enum(['info', 'warning', 'error']),
    context: z.string(),
  }),
]);
