import { container } from '@/container.js';
import { ProgramSourceType } from '@/db/custom_types/ProgramSourceType.js';
import { PlexStreamDetails } from '@/stream/plex/PlexStreamDetails.js';
import type { RouterPluginAsyncCallback } from '@/types/serverType.js';
import { z } from 'zod/v4';

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
          mediaSource: z.string(),
        }),
      },
    },
    async (req, res) => {
      const mediaSource = await req.serverCtx.mediaSourceDB.findByType(
        'plex',
        req.query.mediaSource,
      );
      if (!mediaSource) {
        return res.status(400).send('No media source');
      }

      const program = await req.serverCtx.programDB.lookupByExternalId({
        externalSourceId: mediaSource.name,
        externalKey: req.query.key,
        sourceType: ProgramSourceType.PLEX,
      });

      if (!program) {
        return res.status(400).send('No program');
      }

      const streamDetails = await container.get(PlexStreamDetails).getStream({
        server: mediaSource,
        lineupItem: {
          ...program,
          programId: program.id!,
          externalKey: req.query.key,
          programType: program.subtype,
          streamDuration: 0,
          externalSource: 'plex',
          programBeginMs: 0,
          duration: program.duration,
          type: 'program',
        },
      });

      return res.send(streamDetails);
    },
  );
};
