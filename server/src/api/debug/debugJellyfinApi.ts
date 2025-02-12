import { container } from '@/container.js';
import type { JellyfinApiClient } from '@/external/jellyfin/JellyfinApiClient.js';
import { JellyfinItemFinder } from '@/external/jellyfin/JellyfinItemFinder.js';
import type { RouterPluginAsyncCallback } from '@/types/serverType.js';
import type { Nilable } from '@/types/util.js';
import { isNil } from 'lodash-es';
import { z } from 'zod/v4';
import { MediaSourceType } from '../../db/schema/MediaSource.ts';
import type { MediaSourceApiClientFactory } from '../../external/MediaSourceApiClient.ts';
import { KEYS } from '../../types/inject.ts';

export const DebugJellyfinApiRouter: RouterPluginAsyncCallback = async (
  fastify,
  // eslint-disable-next-line @typescript-eslint/require-await
) => {
  fastify.get(
    '/jellyfin/libraries',
    {
      schema: {
        tags: ['Debug'],
        querystring: z.object({
          userId: z.string(),
          uri: z.string().url(),
          apiKey: z.string(),
        }),
      },
    },
    async (req, res) => {
      const client = container.get<
        MediaSourceApiClientFactory<JellyfinApiClient>
      >(KEYS.JellyfinApiClientFactory)({
        url: req.query.uri,
        accessToken: req.query.apiKey,
        userId: req.query.userId,
        name: 'debug',
        username: null,
      });

      await res.send(await client.getUserLibraries(req.query.userId));
    },
  );

  fastify.get(
    '/jellyfin/library/items',
    {
      schema: {
        tags: ['Debug'],
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
      const client = container.get<
        MediaSourceApiClientFactory<JellyfinApiClient>
      >(KEYS.JellyfinApiClientFactory)({
        url: req.query.uri,
        accessToken: req.query.apiKey,
        name: 'debug',
        userId: null,
        username: null,
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

  fastify.get(
    '/jellyfin/match_program/:id',
    {
      schema: {
        tags: ['Debug'],
        params: z.object({
          id: z.string(),
        }),
      },
    },
    async (req, res) => {
      const finder = container.get(JellyfinItemFinder);
      const match = await finder.findForProgramId(req.params.id);
      return res.status(match ? 200 : 404).send(match);
    },
  );

  fastify.get(
    '/jellyfin/:libraryId/enumerate',
    {
      schema: {
        params: z.object({
          libraryId: z.string(),
        }),
      },
    },
    async (req, res) => {
      const library = await req.serverCtx.mediaSourceDB.getLibrary(
        req.params.libraryId,
      );
      if (!library) {
        return res.status(404).send();
      }

      if (library.mediaSource.type !== MediaSourceType.Jellyfin) {
        return res.status(400).send();
      }

      const jfClient =
        await req.serverCtx.mediaSourceApiFactory.getJellyfinApiClientForMediaSource(
          library.mediaSource,
        );

      switch (library.mediaType) {
        case 'movies':
          for await (const movie of jfClient.getMovieLibraryContents(
            library.externalKey,
          )) {
            console.log(movie);
          }
          break;
        case 'shows': {
          for await (const series of jfClient.getTvShowLibraryContents(
            library.externalKey,
          )) {
            console.log(series);
          }
          break;
        }
        default:
          break;
      }
      return res.send();
    },
  );
};
