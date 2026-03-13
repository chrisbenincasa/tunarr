import z from 'zod/v4';

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

export const LoudnormConfigSchema = z.object({
  i: z.coerce
    .number()
    .min(-70.0)
    .max(-5.0)
    .default(-24.0)
    .describe('integrated loudness target'),
  lra: z.coerce
    .number()
    .min(1.0)
    .max(50.0)
    .default(7.0)
    .describe('loudness range target'),
  tp: z.coerce
    .number()
    .min(-9.0)
    .max(0.0)
    .default(-2.0)
    .describe('maximum true peak'),
  offsetGain: z.coerce
    .number()
    .min(-99.0)
    .max(99.0)
    .optional()
    .describe('offset gain to add before peak limiter'),
});
