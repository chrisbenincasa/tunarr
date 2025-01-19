import { ProgramSourceType } from '@/db/custom_types/ProgramSourceType.js';
import { PlexStreamDetails } from '@/stream/plex/PlexStreamDetails.js';
import { RouterPluginAsyncCallback } from '@/types/serverType.js';
import { z } from 'zod';

export const DebugPlexApiRouter: RouterPluginAsyncCallback = async (
  fastify,
  // eslint-disable-next-line @typescript-eslint/require-await
) => {
  fastify.get(
    '/plex/stream_details',
    {
      schema: {
        querystring: z.object({
          key: z.string(),
          mediaSource: z.string(),
        }),
      },
    },
    async (req, res) => {
      const mediaSource = await req.serverCtx.mediaSourceDB.getByName(
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

      const streamDetails = await new PlexStreamDetails(mediaSource).getStream({
        programId: program.id!,
        externalKey: req.query.key,
        programType: program.subtype,
      });

      return res.send(streamDetails);
    },
  );
};
