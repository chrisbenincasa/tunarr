import { MediaSourceType } from '@/db/schema/base.js';
import { EmbyApiClient } from '@/external/emby/EmbyApiClient.js';
import { TruthyQueryParam } from '@/types/schemas.js';
import { isDefined, nullToUndefined } from '@/util/index.js';
import type { ProgramOrFolder } from '@tunarr/types';
import { tag } from '@tunarr/types';
import { EmbyLoginRequest, PagedResult } from '@tunarr/types/api';
import {
  EmbyItemFields,
  EmbyItemKind,
  EmbyItemSortBy,
} from '@tunarr/types/emby';
import { ItemOrFolder, Library as LibrarySchema } from '@tunarr/types/schemas';
import type { FastifyReply } from 'fastify/types/reply.js';
import { isEmpty, isNil, isUndefined, uniq } from 'lodash-es';
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
          200: z.array(LibrarySchema),
        },
      },
    },
    (req, res) =>
      withEmbyMediaSource(req, res, async (mediaSource) => {
        const api =
          await req.serverCtx.mediaSourceApiFactory.getEmbyApiClientForMediaSource(
            mediaSource,
          );

        const response = await api.getUserLibraries();

        if (response.isFailure()) {
          throw response.error;
        }

        await addTunarrLibraryIdsToResponse(response.get(), mediaSource);

        return res.send(response.get());
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
          parentId: z.string().optional(),
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
          200: PagedResult(ItemOrFolder.array()),
          404: z.string(),
        },
      },
    },
    (req, res) =>
      withEmbyMediaSource(req, res, async (mediaSource) => {
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
          await req.serverCtx.mediaSourceApiFactory.getEmbyApiClientForMediaSource(
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

  async function withEmbyMediaSource<
    Req extends ZodFastifyRequest<{
      params: typeof mediaSourceParams;
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
