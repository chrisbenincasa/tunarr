import { z } from 'zod';

export const TruthyQueryParam = z
  .union([
    z.boolean(),
    z.literal('true'),
    z.literal('false'),
    z.coerce.number(),
  ])
  .transform((value) => value === true || value === 'true');

export const StreamQueryStringSchema = z.object({
  channel: z.coerce.number().or(z.string().uuid()),
  m3u8: TruthyQueryParam.optional(),
  audioOnly: TruthyQueryParam.catch(false),
  session: z.coerce.number().nonnegative().optional(),
  first: z.coerce.number().optional(),
  hls: TruthyQueryParam.optional().catch(false),
  ignoreOnDemand: TruthyQueryParam.optional().catch(false),
  startTime: z.coerce.number().optional(),
});

export type StreamQueryString = z.infer<typeof StreamQueryStringSchema>;
