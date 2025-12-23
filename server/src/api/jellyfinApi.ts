import { MediaSourceType } from '@/db/schema/base.js';
import { JellyfinApiClient } from '@/external/jellyfin/JellyfinApiClient.js';
import { mediaSourceParamsSchema, TruthyQueryParam } from '@/types/schemas.js';
import { isDefined, nullToUndefined } from '@/util/index.js';
import type { ProgramOrFolder } from '@tunarr/types';
import { tag } from '@tunarr/types';
import { JellyfinLoginRequest, PagedResult } from '@tunarr/types/api';
import {
  JellyfinItemFields,
  JellyfinItemKind,
  JellyfinItemSortBy,
  JellyfinLibraryItemsResponse,
} from '@tunarr/types/jellyfin';
import { ItemOrFolder, Library as LibrarySchema } from '@tunarr/types/schemas';
import type { FastifyReply } from 'fastify/types/reply.js';
import { isEmpty, isNil, uniq } from 'lodash-es';
import { z } from 'zod/v4';
import type { MediaSourceWithRelations } from '../db/schema/derivedTypes.js';
import type {
  RouterPluginCallback,
  ZodFastifyRequest,
} from '../types/serverType.js';
import {
  addTunarrLibraryIdsToItems,
  addTunarrLibraryIdsToResponse,
} from '../util/apiUtil.ts';

const mediaSourceParams = z.object({
  mediaSourceId: z.string(),
});

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
          200: z.array(LibrarySchema),
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

        if (response.isFailure()) {
          throw response.error;
        }

        await addTunarrLibraryIdsToResponse(response.get(), mediaSource);

        return res.send(response.get());
      }),
  );

  fastify.get(
    '/jellyfin/:mediaSourceId/libraries/:libraryId/genres',
    {
      schema: {
        params: mediaSourceParamsSchema.extend({
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

        if (response.isFailure()) {
          throw response.error;
        }

        return res.send(response.get());
      }),
  );

  fastify.get(
    '/jellyfin/:mediaSourceId/libraries/:libraryId/items',
    {
      schema: {
        operationId: 'getJellyfinLibraryItems',
        params: mediaSourceParamsSchema.extend({
          libraryId: z.string(),
        }),
        querystring: z.object({
          parentId: z.string().optional(),
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
          200: PagedResult(ItemOrFolder.array()),
          404: z.string(),
        },
      },
    },
    (req, res) =>
      withJellyfinMediaSource(req, res, async (mediaSource) => {
        const library = mediaSource.libraries.find(
          (lib) => lib.uuid === req.params.libraryId,
        );
        if (!library) {
          return res
            .status(404)
            .send(
              `Library ${req.params.libraryId} not found as part of media source ${mediaSource.uuid} (name = ${mediaSource.name})`,
            );
        }

        const api =
          await req.serverCtx.mediaSourceApiFactory.getJellyfinApiClientForMediaSource(
            mediaSource,
          );

        const pageParams =
          isDefined(req.query.offset) && isDefined(req.query.limit)
            ? { offset: req.query.offset, limit: req.query.limit }
            : null;

        const response = await api.getItems(
          req.query.parentId ?? library.externalKey,
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

        if (response.isFailure()) {
          throw response.error;
        }

        const result = {
          ...response.get(),
          result: addTunarrLibraryIdsToItems(
            response.get().result,
            req.params.libraryId,
          ),
        } satisfies PagedResult<ProgramOrFolder[]>;

        return res.send(result);
      }),
  );

  async function withJellyfinMediaSource<
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
