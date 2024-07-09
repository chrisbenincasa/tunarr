import { isNil } from 'lodash-es';
import { JellyfinApiClient } from '../../external/jellyfin/JellyfinApiClient';
import { RouterPluginAsyncCallback } from '../../types/serverType';
import { z } from 'zod';
import { Nilable } from '../../types/util';

export const DebugJellyfinApiRouter: RouterPluginAsyncCallback = async (
  fastify,
  // eslint-disable-next-line @typescript-eslint/require-await
) => {
  fastify.get(
    '/jellyfin/libraries',
    {
      schema: {
        querystring: z.object({
          userId: z.string(),
          uri: z.string().url(),
          apiKey: z.string(),
        }),
      },
    },
    async (req, res) => {
      const client = new JellyfinApiClient({
        url: req.query.uri,
        apiKey: req.query.apiKey,
      });

      await res.send(await client.getUserLibraries(req.query.userId));
    },
  );

  fastify.get(
    '/jellyfin/library/items',
    {
      schema: {
        querystring: z
          .object({
            uri: z.string().url(),
            parentId: z.string().nullable().optional(),
            offset: z.coerce.number().nonnegative().optional(),
            limit: z.coerce.number().positive().optional(),
            apiKey: z.string(),
          })
          .refine(({ offset, limit }) => {
            return isNil(offset) === isNil(limit);
          }, 'offset/limit must either both be defined, or neither'),
      },
    },
    async (req, res) => {
      const client = new JellyfinApiClient({
        url: req.query.uri,
        apiKey: req.query.apiKey,
      });

      let pageParams: Nilable<{ offset: number; limit: number }> = null;
      if (!isNil(req.query.limit) && !isNil(req.query.offset)) {
        pageParams = { offset: req.query.offset, limit: req.query.limit };
      }

      await res.send(
        await client.getItems(null, req.query.parentId, [], [], pageParams),
      );
    },
  );
};
