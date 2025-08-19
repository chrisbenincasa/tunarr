import type { MediaSource } from '@/db/schema/MediaSource.js';
import { MediaSourceType } from '@/db/schema/MediaSource.js';
import { isQueryError } from '@/external/BaseApiClient.js';
import { EmbyApiClient } from '@/external/emby/EmbyApiClient.js';
import { TruthyQueryParam } from '@/types/schemas.js';
import { isDefined, nullToUndefined } from '@/util/index.js';
import { EmbyLoginRequest } from '@tunarr/types/api';
import type { EmbyCollectionType } from '@tunarr/types/emby';
import {
  EmbyItemFields,
  EmbyItemKind,
  EmbyItemSortBy,
  EmbyLibraryItemsResponse,
  type EmbyLibraryItemsResponse as EmbyLibraryItemsResponseType,
} from '@tunarr/types/emby';
import type { FastifyReply } from 'fastify/types/reply.js';
import { filter, isEmpty, isNil, isUndefined, uniq } from 'lodash-es';
import { z } from 'zod/v4';
import type {
  RouterPluginCallback,
  ZodFastifyRequest,
} from '../types/serverType.js';

const mediaSourceParams = z.object({
  mediaSourceId: z.string(),
});

const ValidEmbyCollectionTypes: EmbyCollectionType[] = [
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
];

function isNonEmptyTyped<T>(f: T[]): f is [T, ...T[]] {
  return !isEmpty(f);
}

export const embyApiRouter: RouterPluginCallback = (fastify, _, done) => {
  fastify.addHook('onRoute', (routeOptions) => {
    if (!routeOptions.schema) {
      routeOptions.schema = {};
    }
  });

  fastify.post(
    '/emby/login',
    {
      schema: {
        body: EmbyLoginRequest,
        response: {
          200: z.object({
            accessToken: z.string().optional(),
            userId: z.string().optional(),
          }),
        },
      },
    },
    async (req, res) => {
      const response = await EmbyApiClient.login(
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
    '/emby/:mediaSourceId/user_libraries',
    {
      schema: {
        params: mediaSourceParams,
        response: {
          200: EmbyLibraryItemsResponse,
        },
      },
    },
    (req, res) =>
      withEmbyMediaSource(req, res, async (mediaSource) => {
        const api =
          await req.serverCtx.mediaSourceApiFactory.getEmbyApiClientForMediaSource(
            mediaSource,
          );

        const response = await api.getUserViews();

        if (isQueryError(response)) {
          throw new Error(response.message);
        }

        const sanitizedResponse: EmbyLibraryItemsResponseType = {
          ...response.data,
          Items: filter(response.data.Items, (library) => {
            // Mixed collections don't have this set
            if (!library.CollectionType) {
              return true;
            }

            return ValidEmbyCollectionTypes.includes(
              library.CollectionType as EmbyCollectionType,
            );
          }),
        };

        return res.send(sanitizedResponse);
      }),
  );

  fastify.get(
    '/emby/:mediaSourceId/libraries/:libraryId/items',
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
            .pipe(EmbyItemKind.array())
            .or(z.array(EmbyItemKind).optional()),
          extraFields: z
            .string()
            .optional()
            .transform((s) => s?.split(','))
            .pipe(EmbyItemFields.array().optional())
            .or(z.array(EmbyItemFields).optional()),
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
            .pipe(EmbyItemSortBy.array().optional())
            .or(z.array(EmbyItemSortBy).optional())
            .default(['SortName', 'ProductionYear']),
          recursive: TruthyQueryParam.optional().default(false),
          artistType: z
            .string()
            .optional()
            .transform((s) => s?.split(','))
            .pipe(z.enum(['Artist', 'AlbumArtist']).array().optional())
            .or(z.array(z.enum(['Artist', 'AlbumArtist'])).optional()),
        }),
        response: {
          200: EmbyLibraryItemsResponse,
        },
      },
    },
    (req, res) =>
      withEmbyMediaSource(req, res, async (mediaSource) => {
        const api =
          await req.serverCtx.mediaSourceApiFactory.getEmbyApiClientForMediaSource(
            mediaSource,
          );

        const pageParams =
          isDefined(req.query.offset) && isDefined(req.query.limit)
            ? { offset: req.query.offset, limit: req.query.limit }
            : null;
        const response = await api.getItems(
          null,
          req.params.libraryId,
          req.query.itemTypes ?? [],
          isUndefined(req.query.extraFields)
            ? ['ChildCount']
            : uniq(['ChildCount', ...req.query.extraFields]),
          pageParams,
          {
            // filters: 'IsFolder=false',
            nameStartsWithOrGreater: req.query.nameStartsWithOrGreater,
            nameStartsWith: req.query.nameStartsWith,
            nameLessThan: req.query.nameLessThan,
            genres: req.query.genres,
            recursive: req.query.recursive,
            artistType: req.query.artistType,
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

  async function withEmbyMediaSource<
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

    if (mediaSource.type !== MediaSourceType.Emby) {
      return res
        .status(400)
        .send(
          `Media source with ID = ${req.params.mediaSourceId} is not a Emby server.`,
        );
    }

    return cb(mediaSource);
  }

  done();
};
