import { ChannelProgrammingSchema } from '@tunarr/types/schemas';
import z from 'zod';

export const AllChannelsGuideSchema = {
  querystring: z.object({
    dateFrom: z.coerce.date(),
    dateTo: z.coerce.date(),
  }),
  response: {
    200: z.record(ChannelProgrammingSchema),
  },
};
