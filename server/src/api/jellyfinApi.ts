import { JellyfinLoginRequest } from '@tunarr/types/api';
import {
  JellyfinCollectionType,
  JellyfinItemFields,
  JellyfinItemKind,
  JellyfinItemSortBy,
  JellyfinLibraryItemsResponse,
  type JellyfinLibraryItemsResponse as JellyfinLibraryItemsResponseTyp,
} from '@tunarr/types/jellyfin';
import { FastifyReply } from 'fastify/types/reply.js';
import { filter, isEmpty, isNil, uniq } from 'lodash-es';
import { z } from 'zod';
import { MediaSource, MediaSourceType } from '../db/schema/MediaSource.ts';
import { isQueryError } from '../external/BaseApiClient.js';
import { MediaSourceApiFactory } from '../external/MediaSourceApiFactory.js';
import { JellyfinApiClient } from '../external/jellyfin/JellyfinApiClient.js';
import { TruthyQueryParam } from '../types/schemas.js';
import {
  RouterPluginCallback,
  ZodFastifyRequest,
} from '../types/serverType.js';
import { isDefined, nullToUndefined } from '../util/index.js';

const mediaSourceParams = z.object({
  mediaSourceId: z.string(),
});

const ValidJellyfinCollectionTypes: JellyfinCollectionType[] = [
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

export const jellyfinApiRouter: RouterPluginCallback = (fastify, _, done) => {
  fastify.post(
    '/jellyfin/login',
    {
      schema: {
        body: JellyfinLoginRequest,
      },
    },
    async (req, res) => {
      const response = await JellyfinApiClient.login(
        { url: req.body.url, name: 'Unknown' },
        req.body.username,
        req.body.password,
        req.serverCtx.settings.clientId(),
      );

      return res.send({ accessToken: nullToUndefined(response.AccessToken) });
    },
  );

  fastify.get(
    '/jellyfin/:mediaSourceId/user_libraries',
    {
      schema: {
        params: mediaSourceParams,
      },
    },
    (req, res) =>
      withJellyfinMediaSource(req, res, async (mediaSource) => {
        const api = await MediaSourceApiFactory().getJellyfinClient({
          ...mediaSource,
          url: mediaSource.uri,
          apiKey: mediaSource.accessToken,
        });

        const response = await api.getUserViews();

        if (isQueryError(response)) {
          throw response;
        }

        const sanitizedResponse: JellyfinLibraryItemsResponseTyp = {
          ...response.data,
          Items: filter(response.data.Items, (library) => {
            if (!library.CollectionType) {
              return false;
            }

            return ValidJellyfinCollectionTypes.includes(
              library.CollectionType,
            );
          }),
        };

        return res.send(sanitizedResponse);
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
        }),
        response: {
          200: JellyfinLibraryItemsResponse,
        },
      },
    },
    (req, res) =>
      withJellyfinMediaSource(req, res, async (mediaSource) => {
        const api = await MediaSourceApiFactory().getJellyfinClient({
          ...mediaSource,
          url: mediaSource.uri,
          apiKey: mediaSource.accessToken,
        });

        const pageParams =
          isDefined(req.query.offset) && isDefined(req.query.limit)
            ? { offset: req.query.offset, limit: req.query.limit }
            : null;
        const response = await api.getItems(
          null,
          req.params.libraryId,
          req.query.itemTypes ?? [],
          uniq([
            'ChildCount',
            'RecursiveItemCount',
            ...(req.query.extraFields ?? []),
          ]),
          pageParams,
          {
            // filters: 'IsFolder=false',
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
          throw response;
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
