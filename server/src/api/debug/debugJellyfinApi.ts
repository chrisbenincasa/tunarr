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
        }),
      },
    },
    async (req, res) => {
      const client = new JellyfinApiClient({
        uri: 'http://192.168.0.118:8096',
        apiKey: '2ff5473bf66c407f8c60baf39120d8e7',
        type: 'jellyfin',
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
            parentId: z.string().nullable().optional(),
            offset: z.coerce.number().nonnegative().optional(),
            limit: z.coerce.number().positive().optional(),
          })
          .refine(({ offset, limit }) => {
            return isNil(offset) === isNil(limit);
          }, 'offset/limit must either both be defined, or neither'),
      },
    },
    async (req, res) => {
      const client = new JellyfinApiClient({
        uri: 'http://192.168.0.118:8096',
        apiKey: '2ff5473bf66c407f8c60baf39120d8e7',
        type: 'jellyfin',
      });

      let pageParams: Nilable<{ offset: number; limit: number }> = null;
      if (!isNil(req.query.limit) && !isNil(req.query.offset)) {
        pageParams = { offset: req.query.offset, limit: req.query.limit };
      }

      await res.send(
        await client.getLibrary(null, req.query.parentId, [], pageParams),
      );
    },
  );
};
