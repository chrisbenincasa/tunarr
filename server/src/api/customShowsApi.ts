import type { RouterPluginAsyncCallback } from '@/types/serverType.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import { seq } from '@tunarr/shared/util';
import {
  CreateCustomShowRequestSchema,
  IdPathParamSchema,
  UpdateCustomShowRequestSchema,
} from '@tunarr/types/api';
import { CustomProgramSchema, CustomShowSchema } from '@tunarr/types/schemas';
import { isNil, isNull, isNumber, sumBy } from 'lodash-es';
import { z } from 'zod/v4';
import { MaterializeProgramsCommand } from '../commands/MaterializeProgramsCommand.ts';
import { container } from '../container.ts';
import { parseFloatOrNull } from '../util/index.ts';

// eslint-disable-next-line @typescript-eslint/require-await
export const customShowsApiV2: RouterPluginAsyncCallback = async (fastify) => {
  const logger = LoggerFactory.child({
    caller: import.meta,
    className: 'CustomShowsApi',
  });

  fastify.addHook('onError', (req, _, error, done) => {
    logger.error({ error, url: req.routeOptions.config.url });
    done();
  });

  fastify.get(
    '/custom-shows',
    {
      schema: {
        tags: ['Custom Shows'],
        response: {
          200: z.array(CustomShowSchema),
        },
      },
    },
    async (req, res) => {
      const customShows = await req.serverCtx.customShowDB.getAllShowsInfo();

      return res.send(
        customShows.map((cs) => ({
          id: cs.id,
          name: cs.name,
          contentCount: cs.count,
          totalDuration: isNumber(cs.totalDuration)
            ? cs.totalDuration
            : (parseFloatOrNull(cs.totalDuration) ?? 0),
          syncMediaSourceId: cs.syncMediaSourceId ?? undefined,
          syncMediaSourceType: cs.syncMediaSourceType ?? undefined,
          syncExternalPlaylistId: cs.syncExternalPlaylistId ?? undefined,
          lastSyncedAt: cs.lastSyncedAt?.getTime() ?? undefined,
          isSyncing: req.serverCtx.customShowSyncService.isShowSyncing(cs.id),
        })),
      );
    },
  );

  fastify.get(
    '/custom-shows/:id',
    {
      schema: {
        tags: ['Custom Shows'],
        params: IdPathParamSchema,
        response: {
          200: CustomShowSchema,
          404: z.void(),
        },
      },
    },
    async (req, res) => {
      const customShow = await req.serverCtx.customShowDB.getShow(
        req.params.id,
      );

      if (isNil(customShow)) {
        return res.status(404).send();
      }

      return res.status(200).send({
        id: customShow.uuid,
        name: customShow.name,
        contentCount: customShow.content.length,
        totalDuration: sumBy(
          customShow.content,
          ({ program }) => program.duration ?? 0,
        ),
        syncMediaSourceId: customShow.syncMediaSourceId ?? undefined,
        syncMediaSourceType: customShow.syncMediaSourceType ?? undefined,
        syncExternalPlaylistId: customShow.syncExternalPlaylistId ?? undefined,
        lastSyncedAt: customShow.lastSyncedAt?.getTime() ?? undefined,
        isSyncing: req.serverCtx.customShowSyncService.isShowSyncing(
          customShow.uuid,
        ),
      });
    },
  );

  fastify.put(
    '/custom-shows/:id',
    {
      schema: {
        tags: ['Custom Shows'],
        params: IdPathParamSchema,
        body: UpdateCustomShowRequestSchema,
        response: {
          200: CustomShowSchema,
          404: z.void(),
        },
      },
    },
    async (req, res) => {
      const customShow = await req.serverCtx.customShowDB.saveShow(
        req.params.id,
        req.body,
      );

      if (isNil(customShow)) {
        return res.status(404).send();
      }

      return res.status(200).send({
        id: customShow.uuid,
        name: customShow.name,
        contentCount: customShow.content.length,
        totalDuration: sumBy(
          customShow.content,
          ({ program }) => program.duration ?? 0,
        ),
        syncMediaSourceId: customShow.syncMediaSourceId ?? undefined,
        syncMediaSourceType: customShow.syncMediaSourceType ?? undefined,
        syncExternalPlaylistId: customShow.syncExternalPlaylistId ?? undefined,
        lastSyncedAt: customShow.lastSyncedAt?.getTime() ?? undefined,
        isSyncing: req.serverCtx.customShowSyncService.isShowSyncing(
          customShow.uuid,
        ),
      });
    },
  );

  fastify.get(
    '/custom-shows/:id/programs',
    {
      schema: {
        tags: ['Custom Shows'],
        params: IdPathParamSchema,
        response: {
          200: z.array(CustomProgramSchema),
          404: z.void(),
        },
      },
    },
    async (req, res) => {
      const csc = await req.serverCtx.customShowDB.getShowPrograms(
        req.params.id,
      );
      const materialized = await container
        .get<MaterializeProgramsCommand>(MaterializeProgramsCommand)
        .execute(csc);
      const result = seq.collect(materialized, (csc, idx) => {
        const program =
          req.serverCtx.programConverter.materializedProgramToContentProgram(
            csc,
          );
        if (!program) {
          return;
        }
        return {
          type: 'custom' as const,
          persisted: true,
          duration: csc.duration,
          program,
          customShowId: req.params.id,
          index: idx,
          id: csc.uuid,
        };
      });
      return res.status(200).send(result);
    },
  );

  fastify.post(
    '/custom-shows',
    {
      schema: {
        tags: ['Custom Shows'],
        operationId: 'createCustomShow',
        description: 'Creates a new Custom Show',
        body: CreateCustomShowRequestSchema,
        response: {
          201: CustomShowSchema,
        },
      },
    },
    async (req, res) => {
      const newId = await req.serverCtx.customShowDB.createShow(req.body);

      // If this is a synced custom show, trigger an immediate sync
      if (req.body.syncMediaSourceId && req.body.syncExternalPlaylistId) {
        try {
          await req.serverCtx.customShowSyncService.syncShow(newId);
        } catch (e) {
          logger.error(e, 'Failed initial sync for new custom show %s', newId);
        }
      }

      const newShow = await req.serverCtx.customShowDB.getShow(newId);
      if (!newShow) {
        throw new Error(
          `New show doesn't exist right after inserting, ID = ${newId}`,
        );
      }

      return res.status(201).send({
        id: newShow.uuid,
        name: newShow.name,
        contentCount: newShow.content.length,
        totalDuration: sumBy(
          newShow.content,
          ({ program }) => program.duration ?? 0,
        ),
        syncMediaSourceId: newShow.syncMediaSourceId ?? undefined,
        syncMediaSourceType: newShow.syncMediaSourceType ?? undefined,
        syncExternalPlaylistId: newShow.syncExternalPlaylistId ?? undefined,
        lastSyncedAt: newShow.lastSyncedAt?.getTime() ?? undefined,
        isSyncing: req.serverCtx.customShowSyncService.isShowSyncing(
          newShow.uuid,
        ),
      });
    },
  );

  fastify.delete(
    '/custom-shows/:id',
    {
      schema: {
        tags: ['Custom Shows'],
        operationId: 'deleteCustomShow',
        description: 'Delets a custom show with the given ID',
        params: IdPathParamSchema,
        response: {
          200: z.object({ id: z.string() }),
          404: z.void(),
        },
      },
    },
    async (req, res) => {
      const customShow = await req.serverCtx.customShowDB.getShow(
        req.params.id,
      );

      if (isNull(customShow)) {
        return res.status(404).send();
      }

      await req.serverCtx.customShowDB.deleteShow(req.params.id);

      return res.status(200).send({ id: req.params.id });
    },
  );

  fastify.post(
    '/custom-shows/:id/sync',
    {
      schema: {
        tags: ['Custom Shows'],
        operationId: 'syncCustomShow',
        description:
          'Triggers an immediate sync for a custom show linked to an external playlist',
        params: IdPathParamSchema,
        response: {
          200: CustomShowSchema,
          400: z.object({ error: z.string() }),
          404: z.void(),
        },
      },
    },
    async (req, res) => {
      const show = await req.serverCtx.customShowDB.getShow(req.params.id);

      if (isNil(show)) {
        return res.status(404).send();
      }

      if (!show.syncMediaSourceId || !show.syncExternalPlaylistId) {
        return res
          .status(400)
          .send({ error: 'Custom show is not configured for sync' });
      }

      await req.serverCtx.customShowSyncService.syncShow(show.uuid);

      const updatedShow = await req.serverCtx.customShowDB.getShow(show.uuid);
      if (!updatedShow) {
        throw new Error('Show disappeared after sync');
      }

      return res.status(200).send({
        id: updatedShow.uuid,
        name: updatedShow.name,
        contentCount: updatedShow.content.length,
        totalDuration: sumBy(
          updatedShow.content,
          ({ program }) => program.duration ?? 0,
        ),
        syncMediaSourceId: updatedShow.syncMediaSourceId ?? undefined,
        syncMediaSourceType: updatedShow.syncMediaSourceType ?? undefined,
        syncExternalPlaylistId: updatedShow.syncExternalPlaylistId ?? undefined,
        lastSyncedAt: updatedShow.lastSyncedAt?.getTime() ?? undefined,
      });
    },
  );
};
