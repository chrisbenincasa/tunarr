import type { MediaSource } from '@/db/schema/MediaSource.js';
import { MediaSourceType } from '@/db/schema/MediaSource.js';
import { isQueryError } from '@/external/BaseApiClient.js';
import { JellyfinApiClient } from '@/external/jellyfin/JellyfinApiClient.js';
import { TruthyQueryParam } from '@/types/schemas.js';
import { inConstArr, isDefined, nullToUndefined } from '@/util/index.js';
import { JellyfinLoginRequest } from '@tunarr/types/api';
import type { JellyfinCollectionType } from '@tunarr/types/jellyfin';
import {
  JellyfinItemFields,
  JellyfinItemKind,
  JellyfinItemSortBy,
  JellyfinLibraryItemsResponse,
  TunarrAmendedJellyfinVirtualFolder,
} from '@tunarr/types/jellyfin';
import type { FastifyReply } from 'fastify/types/reply.js';
import { isEmpty, isNil, uniq } from 'lodash-es';
import { z } from 'zod/v4';
import type {
  RouterPluginCallback,
  ZodFastifyRequest,
} from '../types/serverType.js';

const mediaSourceParams = z.object({
  mediaSourceId: z.string(),
});

const ValidJellyfinCollectionTypes = [
  'movies',
  'tvshows',
  'music',
  'trailers',
  'musicvideos',
  'homevideos',
  'playlists',
  'boxsets',
  'folders',
  'unknown',
] satisfies JellyfinCollectionType[];

function isNonEmptyTyped<T>(f: T[]): f is [T, ...T[]] {
  return !isEmpty(f);
}

export const jellyfinApiRouter: RouterPluginCallback = (fastify, _, done) => {
  fastify.addHook('onRoute', (routeOptions) => {
    if (!routeOptions.schema) {
      routeOptions.schema = {};
    }
  });

  fastify.post(
    '/jellyfin/login',
    {
      schema: {
        body: JellyfinLoginRequest,
        operationId: 'jellyfinLogin',
        response: {
          200: z.object({
            accessToken: z.string().optional(),
            userId: z.string().optional(),
          }),
        },
      },
    },
    async (req, res) => {
      const response = await JellyfinApiClient.login(
        req.body.url,
        req.body.username,
        req.body.password,
        req.serverCtx.settings.clientId(),
      );

      return res.send({
        accessToken: nullToUndefined(response.AccessToken),
        userId: nullToUndefined(response.User?.Id),
      });
    },
  );

  fastify.get(
    '/jellyfin/:mediaSourceId/user_libraries',
    {
      schema: {
        params: mediaSourceParams,
        response: {
          // HACK
          200: z.array(TunarrAmendedJellyfinVirtualFolder),
        },
        operationId: 'getJellyfinLibraries',
      },
    },
    (req, res) =>
      withJellyfinMediaSource(req, res, async (mediaSource) => {
        const api =
          await req.serverCtx.mediaSourceApiFactory.getJellyfinApiClientForMediaSource(
            mediaSource,
          );

        const response = await api.getUserViews();

        if (isQueryError(response)) {
          throw new Error(response.message);
        }

        return res.send(
          response.data
            .filter((library) => {
              // Mixed collections don't have this set
              if (!library.CollectionType) {
                return true;
              }

              return inConstArr(
                ValidJellyfinCollectionTypes,
                library.CollectionType ?? '',
              );
            })
            .map((lib) => ({
              ...lib,
              jellyfinType: 'VirtualFolder',
            })),
        );
      }),
  );

  fastify.get(
    '/jellyfin/:mediaSourceId/libraries/:libraryId/genres',
    {
      schema: {
        params: mediaSourceParams.extend({
          libraryId: z.string(),
        }),
        querystring: z.object({
          includeItemTypes: z.string().optional(),
        }),
        response: {
          200: JellyfinLibraryItemsResponse,
        },
        operationId: 'getJellyfinLibraryGenres',
      },
    },
    (req, res) =>
      withJellyfinMediaSource(req, res, async (mediaSource) => {
        const api =
          await req.serverCtx.mediaSourceApiFactory.getJellyfinApiClientForMediaSource(
            mediaSource,
          );

        const response = await api.getGenres(
          req.params.libraryId,
          req.query.includeItemTypes,
        );

        if (isQueryError(response)) {
          throw new Error(response.message);
        }

        return res.send(response.data);
      }),
  );

  fastify.get(
    '/jellyfin/:mediaSourceId/libraries/:libraryId/items',
    {
      schema: {
        params: mediaSourceParams.extend({
          libraryId: z.string(),
        }),
        querystring: z.object({
          offset: z.coerce.number().nonnegative().optional(),
          limit: z.coerce.number().positive().optional(),
          itemTypes: z
            .string()
            .optional()
            .transform((s) => s?.split(','))
            .pipe(JellyfinItemKind.array())
            .or(z.array(JellyfinItemKind).optional()),
          extraFields: z
            .string()
            .optional()
            .transform((s) => s?.split(','))
            .pipe(JellyfinItemFields.array().optional())
            .or(z.array(JellyfinItemFields).optional()),
          // pipe delimited
          genres: z
            .string()
            .optional()
            .transform((s) => s?.split('|').filter((s) => s.trim().length > 0)),
          nameStartsWithOrGreater: z.string().min(1).optional(),
          nameStartsWith: z.string().min(1).optional(),
          nameLessThan: z.string().min(1).optional(),
          sortBy: z
            .string()
            .optional()
            .transform((s) => s?.split(','))
            .pipe(JellyfinItemSortBy.array().optional())
            .or(z.array(JellyfinItemSortBy).optional())
            .default(['SortName', 'ProductionYear']),
          recursive: TruthyQueryParam.optional().default(false),
          parentId: z.string().optional(),
        }),
        response: {
          200: JellyfinLibraryItemsResponse,
        },
        operationId: 'getJellyfinLibraryItems',
      },
    },
    (req, res) =>
      withJellyfinMediaSource(req, res, async (mediaSource) => {
        const api =
          await req.serverCtx.mediaSourceApiFactory.getJellyfinApiClientForMediaSource(
            mediaSource,
          );

        const pageParams =
          isDefined(req.query.offset) && isDefined(req.query.limit)
            ? { offset: req.query.offset, limit: req.query.limit }
            : null;

        const response = await api.getItems(
          null,
          req.query.parentId ?? req.params.libraryId,
          req.query.itemTypes ?? [],
          uniq([
            'ChildCount',
            'RecursiveItemCount',
            ...(req.query.extraFields ?? []),
          ]),
          pageParams,
          {
            nameStartsWithOrGreater: req.query.nameStartsWithOrGreater,
            nameStartsWith: req.query.nameStartsWith,
            nameLessThan: req.query.nameLessThan,
            genres: req.query.genres,
            recursive: req.query.recursive,
          },
          isNonEmptyTyped(req.query.sortBy)
            ? req.query.sortBy
            : ['SortName', 'ProductionYear'],
        );

        if (isQueryError(response)) {
          throw new Error(response.message);
        }

        return res.send(response.data);
      }),
  );

  async function withJellyfinMediaSource<
    Req extends ZodFastifyRequest<{
      params: typeof mediaSourceParams;
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

    if (mediaSource.type !== MediaSourceType.Jellyfin) {
      return res
        .status(400)
        .send(
          `Media source with ID = ${req.params.mediaSourceId} is not a Jellyfin server.`,
        );
    }

    return cb(mediaSource);
  }

  done();
};
