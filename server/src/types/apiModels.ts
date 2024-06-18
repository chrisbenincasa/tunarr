import { BasicIdParamSchema, BasicPagingSchema } from '@tunarr/types/api';
import { CondensedChannelProgrammingSchema } from '@tunarr/types/schemas';
import { z } from 'zod';

export const knownModels = {
  BasicIdParamSchema,
  BasicPagingSchema,
  CondensedChannelProgrammingSchema,
  BasicErrorSchema: z.object({ error: z.string() }),
};
