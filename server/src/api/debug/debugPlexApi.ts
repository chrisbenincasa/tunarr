import { container } from '@/container.js';
import { ProgramSourceType } from '@/db/custom_types/ProgramSourceType.js';
import { PlexStreamDetails } from '@/stream/plex/PlexStreamDetails.js';
import type { RouterPluginAsyncCallback } from '@/types/serverType.js';
import { tag } from '@tunarr/types';
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
      }

      const contentProgram =
        req.serverCtx.programConverter.programDaoToContentProgram(program);

      if (!contentProgram) {
        return res.status(500).send();
      }

      const streamDetails = await container.get(PlexStreamDetails).getStream({
        server: mediaSource,
        lineupItem: {
          ...contentProgram,
          programId: contentProgram.id,
          externalKey: req.query.key,
          programType: contentProgram.subtype,
          externalSource: 'plex',
          duration: contentProgram.duration,
          externalFilePath: contentProgram.serverFilePath,
        },
      });

      return res.send(streamDetails);
    },
  );
};
