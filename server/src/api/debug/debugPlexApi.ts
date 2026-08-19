import type { RouterPluginAsyncCallback } from '@/types/serverType.js';
import { tag } from '@tunarr/types';
import { z } from 'zod';

export const DebugPlexApiRouter: RouterPluginAsyncCallback = async (
  fastify,
  // eslint-disable-next-line @typescript-eslint/require-await
) => {
  fastify.get(
    '/plex/:mediaSourceId/:plexItemId',
    {
      schema: {
        params: z.object({
          mediaSourceId: z.uuid(),
          plexItemId: z.string(),
        }),
      },
    },
    async (req, res) => {
      const mediaSource = await req.serverCtx.mediaSourceDB.getById(
        tag(req.params.mediaSourceId),
      );
      if (!mediaSource) {
        return res.status(404).send('No media source found');
      }

      const client =
        await req.serverCtx.mediaSourceApiFactory.getPlexApiClientForMediaSource(
          mediaSource,
        );

      const result = await client.getItemMetadata(req.params.plexItemId);

      return res.send(result);
    },
  );
};
