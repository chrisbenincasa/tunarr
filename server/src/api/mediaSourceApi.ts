import { MediaSourceType } from '@/db/schema/MediaSource.js';
import { GlobalScheduler } from '@/services/Scheduler.js';
import { UpdateXmlTvTask } from '@/tasks/UpdateXmlTvTask.js';
import type { RouterPluginAsyncCallback } from '@/types/serverType.js';
import { nullToUndefined, wait } from '@/util/index.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import { numberToBoolean } from '@/util/sqliteUtil.js';
import { seq } from '@tunarr/shared/util';
import type { MediaSourceLibrary, MediaSourceSettings } from '@tunarr/types';
import { tag } from '@tunarr/types';
import type {
  MediaSourceStatus,
  MediaSourceUnhealthyStatus,
  ScanProgress,
} from '@tunarr/types/api';
import {
  BaseErrorSchema,
  BasicIdParamSchema,
  InsertMediaSourceRequestSchema,
  MediaSourceStatusSchema,
  ScanProgressSchema,
  UpdateMediaSourceLibraryRequest,
  UpdateMediaSourceRequestSchema,
} from '@tunarr/types/api';
import {
  ContentProgramSchema,
  ExternalSourceTypeSchema,
  MediaSourceLibrarySchema,
  MediaSourceSettingsSchema,
} from '@tunarr/types/schemas';
import { isEmpty, isError, isNil, isNull } from 'lodash-es';
import type { MarkOptional } from 'ts-essentials';
import { match, P } from 'ts-pattern';
import z from 'zod/v4';
import { container } from '../container.ts';
import type { MediaSourceWithLibraries } from '../db/schema/derivedTypes.js';
import { EntityMutex } from '../services/EntityMutex.ts';
import { MediaSourceProgressService } from '../services/scanner/MediaSourceProgressService.ts';
import type { GenericMediaSourceScannerFactory } from '../services/scanner/MediaSourceScanner.ts';
import { KEYS } from '../types/inject.ts';
import { Result } from '../types/result.ts';
import { TruthyQueryParam } from '../types/schemas.ts';

export const mediaSourceRouter: RouterPluginAsyncCallback = async (
  fastify,
  // eslint-disable-next-line @typescript-eslint/require-await
) => {
  const logger = LoggerFactory.child({
    caller: import.meta,
    className: 'MediaSourceApi',
  });

  fastify.get(
    '/media-sources',
    {
      schema: {
        tags: ['Media Source'],
        response: {
          200: z.array(MediaSourceSettingsSchema),
          500: z.string(),
        },
      },
    },
    async (req, res) => {
      const entityLocker = container.get<EntityMutex>(EntityMutex);
      try {
        const sources = await req.serverCtx.mediaSourceDB.getAll();

        const dtos = seq.collect(sources, (source) =>
          convertToApiMediaSource(entityLocker, source),
        );

        return res.send(dtos);
      } catch (err) {
        logger.error(err);
        return res.status(500).send('error');
      }
    },
  );

  fastify.get(
    '/media-sources/:id/libraries',
    {
      schema: {
        tags: ['Media Source'],
        params: BasicIdParamSchema,
        response: {
          200: z.array(MediaSourceLibrarySchema),
          404: z.void(),
          500: z.string(),
        },
      },
    },
    async (req, res) => {
      const mediaSource = await req.serverCtx.mediaSourceDB.getById(
        req.params.id,
      );

      if (!mediaSource) {
        return res.status(404).send();
      }

      const entityLocker = container.get<EntityMutex>(EntityMutex);
      const apiMediaSource = convertToApiMediaSource(entityLocker, mediaSource);
      if (isNull(apiMediaSource)) {
        return res
          .status(500)
          .send('Invalid media source type: ' + mediaSource.type);
      }

      return res.send(
        mediaSource.libraries.map(
          (library) =>
            ({
              ...library,
              id: library.uuid,
              type: mediaSource.type,
              enabled: numberToBoolean(library.enabled),
              lastScannedAt: nullToUndefined(library.lastScannedAt),
              isLocked: entityLocker.isLibraryLocked(library),
              mediaSource: apiMediaSource,
            }) satisfies MediaSourceLibrary,
        ),
      );
    },
  );

  fastify.put(
    '/media-sources/:id/libraries/:libraryId',
    {
      schema: {
        tags: ['Media Source'],
        params: BasicIdParamSchema.extend({
          libraryId: z.string(),
        }),
        body: UpdateMediaSourceLibraryRequest,
        response: {
          200: MediaSourceLibrarySchema,
          404: z.void(),
          500: z.string(),
        },
      },
    },
    async (req, res) => {
      const mediaSource = await req.serverCtx.mediaSourceDB.getById(
        req.params.id,
      );

      if (!mediaSource) {
        return res.status(404).send();
      }

      const entityLocker = container.get(EntityMutex);
      const apiMediaSource = convertToApiMediaSource(entityLocker, mediaSource);
      if (isNull(apiMediaSource)) {
        return res
          .status(500)
          .send('Invalid media source type: ' + mediaSource.type);
      }

      const updatedLibrary =
        await req.serverCtx.mediaSourceDB.setLibraryEnabled(
          req.params.id,
          req.params.libraryId,
          req.body.enabled,
        );

      if (req.body.enabled) {
      }

      return res.send({
        ...updatedLibrary,
        id: updatedLibrary.uuid,
        type: mediaSource.type,
        enabled: numberToBoolean(updatedLibrary.enabled),
        lastScannedAt: nullToUndefined(updatedLibrary.lastScannedAt),
        isLocked: entityLocker.isLibraryLocked(updatedLibrary),
        mediaSource: apiMediaSource,
      });
    },
  );

  fastify.get(
    '/media-libraries/:libraryId',
    {
      schema: {
        tags: ['Media Library'],
        params: z.object({
          libraryId: z.string(),
        }),
        response: {
          200: MediaSourceLibrarySchema.extend({
            mediaSource: MediaSourceSettingsSchema,
          }),
          404: z.void(),
        },
      },
    },
    async (req, res) => {
      const library = await req.serverCtx.mediaSourceDB.getLibrary(
        req.params.libraryId,
      );

      if (!library) {
        return res.status(404).send();
      }

      const entityLocker = container.get<EntityMutex>(EntityMutex);

      return res.send({
        ...library,
        id: library.uuid,
        type: library.mediaSource.type,
        enabled: numberToBoolean(library.enabled),
        lastScannedAt: nullToUndefined(library.lastScannedAt),
        isLocked: entityLocker.isLibraryLocked(library),
        mediaSource: convertToApiMediaSource(
          entityLocker,
          library.mediaSource,
        )!,
        // TODO this is dumb
      } satisfies MediaSourceLibrary & {
        mediaSource: MediaSourceSettings;
      });
    },
  );

  fastify.get(
    '/media-libraries/:libraryId/programs',
    {
      schema: {
        tags: ['Media Library'],
        params: z.object({
          libraryId: z.string(),
        }),
        response: {
          200: z.array(ContentProgramSchema),
          404: z.void(),
        },
      },
    },
    async (req, res) => {
      const library = await req.serverCtx.mediaSourceDB.getLibrary(
        req.params.libraryId,
      );

      if (!library) {
        return res.status(404).send();
      }

      const programs =
        await req.serverCtx.programDB.getMediaSourceLibraryPrograms(
          req.params.libraryId,
        );

      return res.send(
        programs.map((program) =>
          req.serverCtx.programConverter.programDaoToContentProgram(
            program,
            program.externalIds ?? [],
          ),
        ),
      );
    },
  );

  fastify.get(
    '/media-libraries/:libraryId/status',
    {
      schema: {
        params: z.object({
          libraryId: z.string(),
        }),
        response: {
          200: ScanProgressSchema,
        },
      },
    },
    async (req, res) => {
      const progressService = container.get<MediaSourceProgressService>(
        MediaSourceProgressService,
      );

      const progress = progressService.getScanProgress(req.params.libraryId);

      const response = match(progress)
        .returnType<ScanProgress>()
        .with({ state: 'in_progress' }, (ip) => ({
          ...ip,
          startedAt: +ip.startedAt,
        }))
        .with(P._, (p) => p)
        .exhaustive();

      return res.send(response);
    },
  );

  fastify.post(
    '/media-sources/:id/libraries/:libraryId/refresh',
    {
      schema: {
        tags: ['Media Source'],
        params: BasicIdParamSchema.extend({
          libraryId: z.string(),
        }),
        querystring: z.object({
          forceScan: TruthyQueryParam.optional(),
        }),
        response: {
          202: z.void(),
          404: z.void(),
          501: z.void(),
        },
      },
    },
    async (req, res) => {
      const mediaSource = await req.serverCtx.mediaSourceDB.getById(
        req.params.id,
      );

      if (!mediaSource) {
        return res.status(404).send();
      }

      const all = req.params.libraryId === 'all';

      const libraries = all
        ? mediaSource.libraries.filter((lib) => lib.enabled)
        : mediaSource.libraries.filter(
            (lib) => lib.uuid === req.params.libraryId && lib.enabled,
          );

      if (!libraries || isEmpty(libraries)) {
        return res.status(501);
      }

      for (const library of libraries) {
        const scanner = Result.attempt(() =>
          container.get<GenericMediaSourceScannerFactory>(
            KEYS.MediaSourceLibraryScanner,
          )(mediaSource.type, library.mediaType),
        ).orNull();

        if (!scanner) {
          return res.status(504).send();
        }

        scanner
          .scan({ library, force: !!req.query.forceScan })
          .catch((e) =>
            logger.error(e, 'Error scanning library %s', library.uuid),
          );
      }

      return res.status(202).send();
    },
  );

  fastify.get(
    '/media-sources/:id/status',
    {
      schema: {
        tags: ['Media Source'],
        params: BasicIdParamSchema,
        response: {
          200: z.object({
            healthy: z.boolean(),
          }),
          404: z.void(),
          500: z.void(),
        },
      },
    },
    async (req, res) => {
      try {
        const server = await req.serverCtx.mediaSourceDB.getById(req.params.id);

        if (isNil(server)) {
          return res.status(404).send();
        }

        const healthyPromise = match(server)
          .with({ type: 'plex' }, async (server) => {
            return (
              await req.serverCtx.mediaSourceApiFactory.getPlexApiClientForMediaSource(
                server,
              )
            ).checkServerStatus();
          })
          .with({ type: 'jellyfin' }, async (server) => {
            return (
              await req.serverCtx.mediaSourceApiFactory.getJellyfinApiClientForMediaSource(
                server,
              )
            ).ping();
          })
          .with({ type: 'emby' }, async (server) => {
            return (
              await req.serverCtx.mediaSourceApiFactory.getEmbyApiClientForMediaSource(
                server,
              )
            ).ping();
          })
          .exhaustive();

        const status = await Promise.race([
          healthyPromise,
          new Promise<MediaSourceUnhealthyStatus>((resolve) => {
            setTimeout(() => {
              resolve({ healthy: false, status: 'timeout' });
            }, 60000);
          }),
        ]);

        return res.send(status);
      } catch (err) {
        logger.error(err);
        return res.status(500).send();
      }
    },
  );

  fastify.post(
    '/media-sources/foreignstatus',
    {
      schema: {
        tags: ['Media Source'],
        body: z.object({
          name: z.string().optional(),
          accessToken: z.string(),
          uri: z.string(),
          type: ExternalSourceTypeSchema,
          username: z.string().optional(),
        }),
        response: {
          200: MediaSourceStatusSchema,
          404: z.void(),
          500: z.void(),
        },
      },
    },
    async (req, res) => {
      let healthyPromise: Promise<MediaSourceStatus>;
      switch (req.body.type) {
        case 'plex': {
          const plex =
            await req.serverCtx.mediaSourceApiFactory.getPlexApiClient({
              ...req.body,
              url: req.body.uri,
              userId: null,
              username: null,
              name: req.body.name ?? 'unknown',
            });

          healthyPromise = plex.checkServerStatus();
          break;
        }
        case 'jellyfin': {
          const jellyfin =
            await req.serverCtx.mediaSourceApiFactory.getJellyfinApiClient({
              ...req.body,
              url: req.body.uri,
              userId: null,
              username: null,
              name: req.body.name ?? 'unknown',
            });

          healthyPromise = jellyfin.ping();
          break;
        }
        case 'emby': {
          const emby =
            await req.serverCtx.mediaSourceApiFactory.getEmbyApiClient({
              ...req.body,
              url: req.body.uri,
              userId: null,
              username: null,
              name: req.body.name ?? 'unknown',
            });

          healthyPromise = emby.ping();
          break;
        }
      }

      const status = await Promise.race([
        healthyPromise,
        new Promise<MediaSourceUnhealthyStatus>((resolve) => {
          setTimeout(() => {
            resolve({ healthy: false, status: 'timeout' });
          }, 60000);
        }),
      ]);
      console.log(status);

      return res.send(status);
    },
  );

  fastify.delete(
    '/media-sources/:id',
    {
      schema: {
        tags: ['Media Source'],
        params: BasicIdParamSchema,
        response: {
          200: z.void(),
          500: z.void(),
        },
      },
    },
    async (req, res) => {
      try {
        const { deletedServer } =
          await req.serverCtx.mediaSourceDB.deleteMediaSource(req.params.id);

        // Are these useful? What do they even do?
        req.serverCtx.eventService.push({
          type: 'settings-update',
          message: `Media source ${deletedServer.name} removed.`,
          module: 'media-source',
          detail: {
            serverId: req.params.id,
            serverName: deletedServer.name,
            action: 'delete',
          },
          level: 'warning',
        });

        // Regenerate guides
        try {
          GlobalScheduler.getScheduledJob(UpdateXmlTvTask.ID)
            .runNow(true)
            .catch(console.error);
        } catch (e) {
          logger.error('Unable to update guide after lineup update %O', e);
        }

        return res.send();
      } catch (err) {
        logger.error('Error %O', err);
        req.serverCtx.eventService.push({
          type: 'settings-update',
          message: 'Error deleting media-source.',
          module: 'media-source',
          detail: {
            action: 'delete',
            serverId: req.params.id,
            error: isError(err) ? err.message : 'Missing',
          },
          level: 'error',
        });

        return res.status(500).send();
      }
    },
  );

  fastify.put(
    '/media-sources/:id',
    {
      schema: {
        tags: ['Media Source'],
        params: BasicIdParamSchema,
        body: UpdateMediaSourceRequestSchema,
        response: {
          200: z.void(),
          500: z.void(),
        },
      },
    },
    async (req, res) => {
      try {
        const report = await req.serverCtx.mediaSourceDB.updateMediaSource(
          req.body,
        );
        let modifiedPrograms = 0;
        let destroyedPrograms = 0;
        report.forEach((r) => {
          modifiedPrograms += r.modifiedPrograms;
          destroyedPrograms += r.destroyedPrograms;
        });
        req.serverCtx.eventService.push({
          type: 'settings-update',
          message: `Media source ${req.body.name} updated. ${modifiedPrograms} programs modified, ${destroyedPrograms} programs deleted`,
          module: 'media-source',
          detail: {
            serverName: req.body.name,
            action: 'update',
          },
          level: 'warning',
        });

        return res.status(200).send();
      } catch (err) {
        logger.error(err, 'Could not update plex server. ');
        req.serverCtx.eventService.push({
          type: 'settings-update',
          message: 'Error updating media source.',
          module: 'media-source',
          detail: {
            action: 'update',
            serverName: req.body.name,
            error: isError(err) ? err.message : JSON.stringify(err),
          },
          level: 'error',
        });
        return res.status(500).send();
      }
    },
  );

  fastify.post(
    '/media-sources',
    {
      schema: {
        tags: ['Media Source'],
        body: InsertMediaSourceRequestSchema,
        response: {
          201: z.object({
            id: z.string(),
          }),
          // TODO: Change this
          400: z.string(),
        },
      },
    },
    async (req, res) => {
      try {
        const newServerId = await req.serverCtx.mediaSourceDB.addMediaSource(
          req.body,
        );
        req.serverCtx.eventService.push({
          type: 'settings-update',
          message: `Media source "${req.body.name}" added.`,
          module: 'media-source',
          detail: {
            serverId: newServerId,
            serverName: req.body.name,
            action: 'add',
          },
          level: 'success',
        });
        return res.status(201).send({ id: newServerId });
      } catch (err) {
        logger.error(err, 'Could not add media source');
        req.serverCtx.eventService.push({
          type: 'settings-update',
          message: 'Error adding media source.',
          module: 'plex-server',
          detail: {
            action: 'add',
            serverName: req.body.name,
            error: isError(err) ? err.message : JSON.stringify(err),
          },
          level: 'error',
        });
        return res.status(500).send('Could not add media source.');
      }
    },
  );

  fastify.get(
    '/plex/status',
    {
      schema: {
        tags: ['Media Source'],
        querystring: z.object({
          serverName: z.string(),
        }),
        response: {
          200: MediaSourceStatusSchema,
          404: BaseErrorSchema,
          500: BaseErrorSchema,
        },
      },
    },
    async (req, res) => {
      try {
        const server = await req.serverCtx.mediaSourceDB.findByType(
          MediaSourceType.Plex,
          req.query.serverName,
        );

        if (isNil(server)) {
          return res.status(404).send({ message: 'Plex server not found.' });
        }

        const plex =
          await req.serverCtx.mediaSourceApiFactory.getPlexApiClientForMediaSource(
            server,
          );

        const s: MediaSourceStatus = await Promise.race([
          plex.checkServerStatus(),
          wait(15000).then(
            () =>
              ({
                healthy: false,
                status: 'timeout',
              }) satisfies MediaSourceUnhealthyStatus,
          ),
        ]);

        return res.send(s);
      } catch (err) {
        return res.status(500).send({
          message: isError(err) ? err.message : 'Unknown error occurred',
        });
      }
    },
  );

  // TODO put this in its own class.
  function convertToApiMediaSource(
    entityLocker: EntityMutex,
    source: MarkOptional<MediaSourceWithLibraries, 'libraries'>,
  ): MediaSourceSettings | null {
    return match(source)
      .returnType<MediaSourceSettings | null>()
      .with(
        { type: P.union('plex', 'jellyfin', 'emby') },
        (source) =>
          ({
            id: tag(source.uuid),
            index: source.index,
            uri: source.uri,
            type: source.type,
            name: source.name,
            accessToken: source.accessToken,
            clientIdentifier: nullToUndefined(source.clientIdentifier),
            sendChannelUpdates: numberToBoolean(source.sendChannelUpdates),
            sendGuideUpdates: numberToBoolean(source.sendGuideUpdates),
            libraries: (source.libraries ?? []).map((library) => ({
              ...library,
              id: library.uuid,
              type: source.type,
              enabled: numberToBoolean(library.enabled),
              lastScannedAt: nullToUndefined(library.lastScannedAt),
              isLocked: entityLocker.isLibraryLocked(library),
            })),
            userId: source.userId,
            username: source.username,
          }) satisfies MediaSourceSettings,
      )
      .otherwise(() => null);
  }
};
