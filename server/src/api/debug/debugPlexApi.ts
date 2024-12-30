import { MediaSourceApiFactory } from '@/external/MediaSourceApiFactory.ts';
import { PlexMediaSourceScanner } from '@/services/scanner/PlexMediaSourceScanner.ts';
import { RouterPluginAsyncCallback } from '@/types/serverType.ts';
import { z } from 'zod';

export const DebugPlexApiRouter: RouterPluginAsyncCallback = async (
  fastify,
  // eslint-disable-next-line @typescript-eslint/require-await
) => {
  fastify.get(
    '/plex/enumerate_library',
    {
      schema: {
        querystring: z.object({
          mediaSourceId: z.string(),
          libraryId: z.string(),
        }),
      },
    },
    async (req, res) => {
      const mediaSource = await req.serverCtx.mediaSourceDB.getById(
        req.query.mediaSourceId,
      );
      if (!mediaSource) {
        return res.status(400).send();
      }

      const api = MediaSourceApiFactory().get(mediaSource);

      for await (const movie of api.getMovieLibraryContents(
        req.query.libraryId,
      )) {
        console.log(movie);
      }

      return res.send();
    },
  );

  fastify.get(
    '/plex/scan_library',
    {
      schema: {
        querystring: z.object({
          mediaSourceId: z.string(),
          libraryId: z.string(),
        }),
      },
    },
    async (req, res) => {
      const mediaSource = await req.serverCtx.mediaSourceDB.getById(
        req.query.mediaSourceId,
      );
      if (!mediaSource) {
        return res.status(400).send();
      }

      await new PlexMediaSourceScanner(
        req.serverCtx.mediaSourceDB,
        req.serverCtx.programDB,
      ).scan(req.query.mediaSourceId, req.query.libraryId);

      return res.send();
    },
  );
};
