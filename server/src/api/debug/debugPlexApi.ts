import { container } from '@/container.js';
import { ProgramSourceType } from '@/db/custom_types/ProgramSourceType.js';
import { PlexStreamDetails } from '@/stream/plex/PlexStreamDetails.js';
import type { RouterPluginAsyncCallback } from '@/types/serverType.js';
import { tag } from '@tunarr/types';
import { z } from 'zod/v4';
import { BackfillPlexClientIdentifierCommand } from '../../commands/media_source/BackfillPlexClientIdentifier.ts';

export const DebugPlexApiRouter: RouterPluginAsyncCallback = async (
  fastify,
  // eslint-disable-next-line @typescript-eslint/require-await
) => {
  fastify.get(
    '/plex/stream_details',
    {
      schema: {
        tags: ['Debug'],
        querystring: z.object({
          key: z.string(),
          mediaSource: z.uuid(),
        }),
      },
    },
    async (req, res) => {
      const mediaSource = await req.serverCtx.mediaSourceDB.findByType(
        'plex',
        tag(req.query.mediaSource),
      );
      if (!mediaSource) {
        return res.status(400).send('No media source');
      }

      const program = await req.serverCtx.programDB.lookupByExternalId({
        externalSourceId: mediaSource.uuid,
        externalKey: req.query.key,
        sourceType: ProgramSourceType.PLEX,
      });

      if (!program) {
        return res.status(400).send('No program');
      } else if (!program.mediaSourceId) {
        return res.status(400).send('No media source ID');
      } else if (program.sourceType !== 'plex') {
        return res.status(400).send('Not a plex item');
      }

      const mediaSourceId = program.mediaSourceId;

      const streamDetails = await container.get(PlexStreamDetails).getStream({
        server: mediaSource,
        lineupItem: {
          ...program,
          sourceType: 'plex',
          mediaSourceId,
        },
      });

      return res.send(streamDetails);
    },
  );

  fastify.get(
    '/plex/resources',
    {
      schema: {
        tags: ['Debug'],
        querystring: z.object({
          mediaSource: z.uuid(),
        }),
      },
    },
    async (req, res) => {
      const mediaSource = await req.serverCtx.mediaSourceDB.findByType(
        'plex',
        tag(req.query.mediaSource),
      );
      if (!mediaSource) {
        return res.status(400).send('No media source');
      }

      const client =
        await req.serverCtx.mediaSourceApiFactory.getPlexApiClientForMediaSource(
          mediaSource,
        );

      await container
        .get(BackfillPlexClientIdentifierCommand)
        .run({ mediaSourceId: tag(req.query.mediaSource) });

      return res.send(await client.getResources());
    },
  );
};
