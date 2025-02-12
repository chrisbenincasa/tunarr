import {
  MakePlexMediaContainerResponseSchema,
  PlexLibrariesResponseSchema,
  PlexLibraryCollectionSchema,
  PlexMediaContainerResponseSchema,
  PlexPlaylistSchema,
} from '@tunarr/types/plex';
import type { FastifyReply } from 'fastify/types/reply.js';
import { isNil } from 'lodash-es';
import { z } from 'zod/v4';
import type { PageParams } from '../db/interfaces/IChannelDB.ts';
import { type MediaSource, MediaSourceType } from '../db/schema/MediaSource.ts';
import { mediaSourceParamsSchema } from '../types/schemas.ts';
import type {
  RouterPluginAsyncCallback,
  ZodFastifyRequest,
} from '../types/serverType.js';
import type { Maybe } from '../types/util.ts';

// eslint-disable-next-line @typescript-eslint/require-await
export const plexApiRouter: RouterPluginAsyncCallback = async (fastify, _) => {
  fastify.addHook('onRoute', (routeOptions) => {
    if (!routeOptions.schema) {
      routeOptions.schema = {};
    }

    routeOptions.schema.hide = true;
  });

  fastify.get(
    '/plex/:mediaSourceId/libraries',
    {
      schema: {
        params: mediaSourceParamsSchema,
        response: {
          200: PlexLibrariesResponseSchema,
        },
      },
    },
    async (req, res) => {
      await withPlexMediaSource(req, res, async (mediaSource) => {
        const api =
          await req.serverCtx.mediaSourceApiFactory.getPlexApiClientForMediaSource(
            mediaSource,
          );

        const result = await api.getLibraries();

        if (result.isFailure()) {
          throw result.error;
        }

        return res.send(result.get());
      });
    },
  );

  fastify.get(
    '/plex/:mediaSourceId/libraries/:libraryId/collections',
    {
      schema: {
        params: mediaSourceParamsSchema.extend({
          libraryId: z.string(),
        }),
        querystring: z.object({
          offset: z.coerce.number().nonnegative().optional(),
          limit: z.coerce.number().nonnegative().optional(),
        }),
        response: {
          200: MakePlexMediaContainerResponseSchema(
            PlexLibraryCollectionSchema,
          ),
        },
      },
    },
    async (req, res) => {
      await withPlexMediaSource(req, res, async (mediaSource) => {
        const api =
          await req.serverCtx.mediaSourceApiFactory.getPlexApiClientForMediaSource(
            mediaSource,
          );

        let pageParams: Maybe<PageParams>;
        if (!isNil(req.query.offset) && !isNil(req.query.limit)) {
          pageParams = {
            limit: req.query.limit,
            offset: req.query.offset,
          };
        }

        const result = await api.getLibraryCollections(
          req.params.libraryId,
          pageParams,
        );

        if (result.isFailure()) {
          throw result.error;
        }

        return res.send(result.get());
      });
    },
  );

  fastify.get(
    '/plex/:mediaSourceId/libraries/:libraryId/playlists',
    {
      schema: {
        params: mediaSourceParamsSchema.extend({
          libraryId: z.string(),
        }),
        querystring: z.object({
          offset: z.coerce.number().nonnegative().optional(),
          limit: z.coerce.number().nonnegative().optional(),
        }),
        response: {
          200: MakePlexMediaContainerResponseSchema(PlexPlaylistSchema),
        },
      },
    },
    async (req, res) => {
      await withPlexMediaSource(req, res, async (mediaSource) => {
        const api =
          await req.serverCtx.mediaSourceApiFactory.getPlexApiClientForMediaSource(
            mediaSource,
          );

        let pageParams: Maybe<PageParams>;
        if (!isNil(req.query.offset) && !isNil(req.query.limit)) {
          pageParams = {
            limit: req.query.limit,
            offset: req.query.offset,
          };
        }

        const result = await api.getPlaylists(req.params.libraryId, pageParams);

        if (result.isFailure()) {
          throw result.error;
        }

        return res.send(result.get());
      });
    },
  );

  fastify.get(
    '/plex/:mediaSourceId/playlists',
    {
      schema: {
        params: mediaSourceParamsSchema,
        querystring: z.object({
          offset: z.coerce.number().nonnegative().optional(),
          limit: z.coerce.number().nonnegative().optional(),
        }),
        response: {
          200: MakePlexMediaContainerResponseSchema(PlexPlaylistSchema),
        },
      },
    },
    async (req, res) => {
      await withPlexMediaSource(req, res, async (mediaSource) => {
        const api =
          await req.serverCtx.mediaSourceApiFactory.getPlexApiClientForMediaSource(
            mediaSource,
          );

        let pageParams: Maybe<PageParams>;
        if (!isNil(req.query.offset) && !isNil(req.query.limit)) {
          pageParams = {
            limit: req.query.limit,
            offset: req.query.offset,
          };
        }

        const result = await api.getPlaylists(undefined, pageParams);

        if (result.isFailure()) {
          throw result.error;
        }

        return res.send(result.get());
      });
    },
  );

  fastify.get(
    '/plex/:mediaSourceId/items/:itemId/children',
    {
      schema: {
        params: mediaSourceParamsSchema.extend({
          itemId: z.string(),
        }),
        querystring: z.object({
          parentType: z.enum(['item', 'collection', 'playlist']),
        }),
        response: {
          200: PlexMediaContainerResponseSchema,
        },
      },
    },
    async (req, res) => {
      await withPlexMediaSource(req, res, async (mediaSource) => {
        const api =
          await req.serverCtx.mediaSourceApiFactory.getPlexApiClientForMediaSource(
            mediaSource,
          );

        const result = await api.getItemChildren(
          req.params.itemId,
          req.query.parentType,
        );

        if (result.isFailure()) {
          throw result.error;
        }

        return res.send(result.get());
      });
    },
  );

  async function withPlexMediaSource<
    Req extends ZodFastifyRequest<{
      params: typeof mediaSourceParamsSchema;
    }>,
  >(
    req: Req,
    res: FastifyReply,
    cb: (m: MediaSource) => Promise<FastifyReply>,
  ) {
    const mediaSource = await req.serverCtx.mediaSourceDB.getById(
      req.params.mediaSourceId,
    );

    if (isNil(mediaSource)) {
      return res
        .status(400)
        .send(`No media source with ID ${req.params.mediaSourceId} found.`);
    }

    if (mediaSource.type !== MediaSourceType.Plex) {
      return res
        .status(400)
        .send(
          `Media source with ID = ${req.params.mediaSourceId} is not a Jellyfin server.`,
        );
    }

    return cb(mediaSource);
  }
};
