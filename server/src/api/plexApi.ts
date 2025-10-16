import { MediaSourceType } from '@/db/schema/base.js';
import { tag, type Library } from '@tunarr/types';
import { PagedResult } from '@tunarr/types/api';
import {
  PlexFiltersResponseSchema,
  PlexTagResultSchema,
} from '@tunarr/types/plex';
import {
  Collection,
  ItemOrFolder,
  ItemSchema,
  Library as LibrarySchema,
  Playlist,
} from '@tunarr/types/schemas';
import type { FastifyReply } from 'fastify/types/reply.js';
import { isNil } from 'lodash-es';
import { z } from 'zod/v4';
import type { PageParams } from '../db/interfaces/IChannelDB.ts';
import type { MediaSourceWithRelations } from '../db/schema/derivedTypes.js';
import { ServerRequestContext } from '../ServerContext.ts';
import { mediaSourceParamsSchema } from '../types/schemas.ts';
import type {
  RouterPluginAsyncCallback,
  ZodFastifyRequest,
} from '../types/serverType.js';
import type { Maybe } from '../types/util.ts';
import { groupByUniq, isDefined } from '../util/index.ts';

// eslint-disable-next-line @typescript-eslint/require-await
export const plexApiRouter: RouterPluginAsyncCallback = async (fastify, _) => {
  fastify.addHook('onRoute', (routeOptions) => {
    if (!routeOptions.schema) {
      routeOptions.schema = {};
    }
  });

  fastify.get(
    '/plex/:mediaSourceId/search',
    {
      schema: {
        params: mediaSourceParamsSchema,
        querystring: z.object({
          key: z.string(),
          searchParam: z.string().optional(),
          offset: z.coerce.number().optional(),
          limit: z.coerce.number().optional(),
          parentType: z.string().optional(),
        }),
        response: {
          200: PagedResult(ItemSchema.array()),
          400: z.string(),
        },
      },
    },
    async (req, res) => {
      return await withPlexMediaSource(req, res, async (ms) => {
        const api =
          await req.serverCtx.mediaSourceApiFactory.getPlexApiClientForMediaSource(
            ms,
          );

        // const library = ms.libraries.find(
        //   (lib) => lib.externalKey === req.query.key,
        // );

        // if (
        //   !library &&
        //   req.query.parentType !== 'playlist' &&
        //   req.query.parentType !== 'collection'
        // ) {
        //   return res
        //     .status(400)
        //     .send(
        //       `No Tunarr library found for media source ID ${ms.uuid} with external key ${req.query.key}`,
        //     );
        // }

        const result = await api.search(
          req.query.key,
          isDefined(req.query.offset) && isDefined(req.query.limit)
            ? { offset: req.query.offset, limit: req.query.limit }
            : undefined,
          req.query.searchParam,
          req.query.parentType,
        );

        if (result.isFailure()) {
          throw result.error;
        }

        return res.send(result.get());
      });
    },
  );

  fastify.get(
    '/plex/:mediaSourceId/libraries',
    {
      schema: {
        params: mediaSourceParamsSchema,
        response: {
          200: z.array(LibrarySchema),
        },
      },
    },
    async (req, res) => {
      return await withPlexMediaSource(req, res, async (mediaSource) => {
        const api =
          await req.serverCtx.mediaSourceApiFactory.getPlexApiClientForMediaSource(
            mediaSource,
          );

        const result = await api.getLibraries();

        if (result.isFailure()) {
          throw result.error;
        }

        await result.forEachAsync((response) =>
          addTunarrLibraryIdsToResponse(response, mediaSource),
        );

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
          200: PagedResult(Collection.array()),
        },
      },
    },
    async (req, res) => {
      return await withPlexMediaSource(req, res, async (mediaSource) => {
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
          200: PagedResult(Playlist.array()),
        },
      },
    },
    async (req, res) => {
      return await withPlexMediaSource(req, res, async (mediaSource) => {
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
          200: PagedResult(Playlist.array()),
        },
      },
    },
    async (req, res) => {
      return await withPlexMediaSource(req, res, async (mediaSource) => {
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
    '/plex/:mediaSourceId/filters',
    {
      schema: {
        params: mediaSourceParamsSchema,
        querystring: z.object({
          key: z.string(),
        }),
        response: {
          200: PlexFiltersResponseSchema,
        },
      },
    },
    async (req, res) => {
      return await withPlexMediaSource(req, res, async (mediaSource) => {
        const api =
          await req.serverCtx.mediaSourceApiFactory.getPlexApiClientForMediaSource(
            mediaSource,
          );
        const result = await api.getFilters(req.query.key);
        if (result.isFailure()) {
          throw result.error;
        }
        return res.send(result.get());
      });
    },
  );

  fastify.get(
    '/plex/:mediaSourceId/tags',
    {
      schema: {
        params: mediaSourceParamsSchema,
        querystring: z.object({
          libraryKey: z.string(),
          itemKey: z.string(),
        }),
        response: {
          200: PlexTagResultSchema,
        },
      },
    },
    async (req, res) => {
      return await withPlexMediaSource(req, res, async (mediaSource) => {
        const api =
          await req.serverCtx.mediaSourceApiFactory.getPlexApiClientForMediaSource(
            mediaSource,
          );
        const result = await api.getTags(
          req.query.libraryKey,
          req.query.itemKey,
        );
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
          200: z.array(ItemOrFolder),
        },
      },
    },
    async (req, res) => {
      return await withPlexMediaSource(req, res, async (mediaSource) => {
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
    cb: (m: MediaSourceWithRelations) => Promise<FastifyReply>,
  ) {
    const mediaSource = await req.serverCtx.mediaSourceDB.getById(
      tag(req.params.mediaSourceId),
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

async function addTunarrLibraryIdsToResponse(
  response: Library[],
  mediaSource: MediaSourceWithRelations,
  attempts: number = 1,
) {
  if (attempts > 2) {
    return;
  }

  const librariesByExternalId = groupByUniq(
    mediaSource.libraries,
    (lib) => lib.externalKey,
  );
  let needsRefresh = false;
  for (const library of response) {
    const tunarrLibrary = librariesByExternalId[library.externalId];
    if (!tunarrLibrary) {
      needsRefresh = true;
      continue;
    }

    library.uuid = tunarrLibrary.uuid;
  }

  if (needsRefresh) {
    const ctx = ServerRequestContext.currentServerContext()!;
    await ctx.mediaSourceLibraryRefresher.refreshMediaSource(mediaSource);
    // This definitely exists...
    const newMediaSource = await ctx.mediaSourceDB.getById(mediaSource.uuid);
    return addTunarrLibraryIdsToResponse(
      response,
      newMediaSource!,
      attempts + 1,
    );
  }

  return;
}
