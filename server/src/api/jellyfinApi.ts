import { MediaSourceType } from '@/db/schema/base.js';
import { JellyfinApiClient } from '@/external/jellyfin/JellyfinApiClient.js';
import { mediaSourceParamsSchema, TruthyQueryParam } from '@/types/schemas.js';
import { groupByUniq, isDefined, nullToUndefined } from '@/util/index.js';
import { tag, type Library } from '@tunarr/types';
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
import { ServerRequestContext } from '../ServerContext.ts';
import type {
  RouterPluginCallback,
  ZodFastifyRequest,
} from '../types/serverType.js';

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

        // const amendedResponse = response
        //   .get()
        //   .filter((library) => {
        //     // Mixed collections don't have this set
        //     if (!library.CollectionType) {
        //       return true;
        //     }

        //     return inConstArr(
        //       ValidJellyfinCollectionTypes,
        //       library.CollectionType ?? '',
        //     );
        //   })
        //   .map(
        //     (lib) =>
        //       ({
        //         ...lib,
        //         jellyfinType: 'VirtualFolder',
        //       }) satisfies TunarrAmendedJellyfinVirtualFolder,
        //   );

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
          200: PagedResult(ItemOrFolder.array()),
        },
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

        if (response.isFailure()) {
          throw response.error;
        }

        return res.send(response.get());
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
