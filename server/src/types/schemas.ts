import { z } from 'zod';

export const TruthyQueryParam = z
  .string()
  .transform((s) => s === 'true' || s === '1');

export const StreamQueryStringSchema = z.object({
  channel: z.coerce.number().or(z.string().uuid()),
  m3u8: TruthyQueryParam.optional(),
  audioOnly: TruthyQueryParam.default('0'),
  session: z.coerce.number().optional(),
  first: z.coerce.number().optional(),
  hls: TruthyQueryParam.optional().default('0'),
  ignoreOnDemand: TruthyQueryParam.optional().default('0'),
  startTime: z.coerce.number().optional(),
});

export type StreamQueryString = z.infer<typeof StreamQueryStringSchema>;
