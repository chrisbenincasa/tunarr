import { GlobalScheduler } from '@/services/Scheduler.js';
import { UpdateXmlTvTask } from '@/tasks/UpdateXmlTvTask.js';
import type { RouterPluginAsyncCallback } from '@/types/serverType.js';
import { nullToUndefined, run } from '@/util/index.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import { seq } from '@tunarr/shared/util';
import type { LocalMediaSource } from '@tunarr/types';
import {
  tag,
  type MediaSourceLibrary,
  type MediaSourceSettings,
} from '@tunarr/types';
import type {
  MediaSourceStatus,
  MediaSourceUnhealthyStatus,
  ScanProgress,
} from '@tunarr/types/api';
import {
  BasicIdParamSchema,
  InsertMediaSourceRequestSchema,
  MediaSourceStatusSchema,
  ScanProgressSchema,
  UpdateMediaSourceLibraryRequest,
  UpdateMediaSourceRequestSchema,
} from '@tunarr/types/api';
import {
  ContentProgramSchema,
  MediaSourceLibrarySchema,
  MediaSourceSettingsSchema,
} from '@tunarr/types/schemas';
import dayjs from 'dayjs';
import { isEmpty, isError, isNil, isNull } from 'lodash-es';
import type { MarkOptional, StrictExtract } from 'ts-essentials';
import { match, P } from 'ts-pattern';
import { v4 } from 'uuid';
import z from 'zod/v4';
import { container } from '../container.ts';
import type { MediaSourceWithRelations } from '../db/schema/derivedTypes.js';
import { EntityMutex } from '../services/EntityMutex.ts';
import { MediaSourceLibraryRefresher } from '../services/MediaSourceLibraryRefresher.ts';
import { MediaSourceProgressService } from '../services/scanner/MediaSourceProgressService.ts';
import { TruthyQueryParam } from '../types/schemas.ts';
import { fileExists } from '../util/fsUtil.ts';

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
    '/media-sources/:mediaSourceId',
    {
      schema: {
        tags: ['Media Source'],
        params: z.object({
          mediaSourceId: z.uuid(),
        }),
        response: {
          200: MediaSourceSettingsSchema,
          404: z.void(),
          500: z.string(),
        },
      },
    },
    async (req, res) => {
      try {
        const source = await req.serverCtx.mediaSourceDB.getById(
          tag(req.params.mediaSourceId),
        );
        if (!source) {
          return res.status(404).send();
        }
        const entityLocker = container.get<EntityMutex>(EntityMutex);

        const dto = convertToApiMediaSource(entityLocker, source);

        return res.send(dto);
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
          400: z.void(),
          404: z.void(),
          500: z.string(),
        },
      },
    },
    async (req, res) => {
      const mediaSource = await req.serverCtx.mediaSourceDB.getById(
        tag(req.params.id),
      );

      if (!mediaSource) {
        return res.status(404).send();
      }

      if (mediaSource.type === 'local') {
        return res.status(400).send();
      }

      const entityLocker = container.get<EntityMutex>(EntityMutex);
      const apiMediaSource = convertToApiMediaSource(entityLocker, mediaSource);
      if (isNull(apiMediaSource)) {
        return res
          .status(500)
          .send('Invalid media source type: ' + mediaSource.type);
      }

      const libraries = mediaSource.libraries.map(
        (library) =>
          ({
            ...library,
            id: library.uuid,
            type: mediaSource.type,
            enabled: library.enabled,
            lastScannedAt: library.lastScannedAt
              ? +dayjs(library.lastScannedAt)
              : undefined,
            isLocked:
              entityLocker.isLibraryLocked(library) ||
              entityLocker.isMediaSourceLocked(mediaSource),
            mediaSource: apiMediaSource,
          }) satisfies MediaSourceLibrary,
      );

      // const localLibraries = mediaSource.paths.map(path => ({
      //   id: path.
      // } satisfies MediaSourceLibrary))

      return res.send(libraries);
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
          400: z.string(),
          404: z.string(),
          500: z.string(),
        },
      },
    },
    async (req, res) => {
      const mediaSource = await req.serverCtx.mediaSourceDB.getById(
        tag(req.params.id),
      );

      if (!mediaSource) {
        return res
          .status(404)
          .send(`Media source with ID ${req.params.id} not found`);
      }

      if (mediaSource.type === 'local') {
        return res
          .status(400)
          .send('Local media sources do not support libraries.');
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
          tag(req.params.id),
          req.params.libraryId,
          req.body.enabled,
        );

      if (req.body.enabled) {
        const result = await req.serverCtx.mediaSourceScanCoordinator.add({
          libraryId: updatedLibrary.uuid,
          forceScan: false,
        });
        if (!result) {
          logger.error(
            'Unable to schedule library ID %s for scanning',
            updatedLibrary.uuid,
          );
        }
      }

      return res.send({
        ...updatedLibrary,
        id: updatedLibrary.uuid,
        type: mediaSource.type,
        enabled: updatedLibrary.enabled,
        lastScannedAt: nullToUndefined(updatedLibrary.lastScannedAt)?.valueOf(),
        isLocked:
          entityLocker.isLibraryLocked(updatedLibrary) ||
          entityLocker.isMediaSourceLocked(mediaSource),
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
        // ...library,
        id: library.uuid,
        type: library.mediaSource.type,
        enabled: library.enabled,
        lastScannedAt: library.lastScannedAt?.valueOf(),
        isLocked:
          entityLocker.isLibraryLocked(library) ||
          entityLocker.isMediaSourceLocked(library.mediaSource),
        name: library.name,
        mediaType: library.mediaType,
        externalKey: library.externalKey,
        mediaSource: convertToApiMediaSource(entityLocker, library.mediaSource),
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
        seq.collect(programs, (program) =>
          req.serverCtx.programConverter.programDaoToContentProgram(
            program,
            program.externalIds ?? [],
          ),
        ),
      );
    },
  );

  fastify.get(
    '/media-sources/:mediaSourceId/:libraryId/status',
    {
      schema: {
        params: z.object({
          mediaSourceId: z.string(),
          libraryId: z.string(),
        }),
        response: {
          200: ScanProgressSchema,
          404: z.void(),
        },
      },
    },
    async (req, res) => {
      const progressService = container.get<MediaSourceProgressService>(
        MediaSourceProgressService,
      );
      const mediaSource = await req.serverCtx.mediaSourceDB.getById(
        tag(req.params.mediaSourceId),
      );

      if (!mediaSource) {
        return res.status(404).send();
      }

      if (req.params.libraryId !== 'all') {
        const lib = mediaSource.libraries.find(
          (lib) => lib.uuid === req.params.libraryId,
        );
        if (!lib) {
          return res.status(404).send();
        }
      }

      const progress =
        req.params.libraryId === 'all'
          ? progressService.getScanProgress(req.params.mediaSourceId)
          : progressService.getScanProgress(req.params.libraryId);

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
    '/media-sources/:id/libraries/refresh',
    {
      schema: {
        tags: ['Media Source'],
        params: BasicIdParamSchema,
        response: {
          200: z.void(),
          404: z.void(),
          501: z.void(),
        },
      },
    },
    async (req, res) => {
      const mediaSource = await req.serverCtx.mediaSourceDB.getById(
        tag(req.params.id),
      );

      if (!mediaSource) {
        return res.status(404).send();
      }

      const refresher = container.get<MediaSourceLibraryRefresher>(
        MediaSourceLibraryRefresher,
      );

      await refresher.refreshAll();

      return res.status(200).send();
    },
  );

  fastify.post(
    '/media-sources/:id/scan',
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
        tag(req.params.id),
      );

      if (!mediaSource) {
        return res.status(404).send();
      }
    },
  );

  fastify.post(
    '/media-sources/:id/libraries/:libraryId/scan',
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
        tag(req.params.id),
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

      if (mediaSource.type === 'local') {
        const result = await req.serverCtx.mediaSourceScanCoordinator.addLocal({
          forceScan: !!req.query.forceScan,
          mediaSourceId: mediaSource.uuid,
        });
        if (!result) {
          logger.error(
            'Unable to schedule local media source ID %s for scanning',
            mediaSource.uuid,
          );
        }
      } else {
        for (const library of libraries) {
          const result = await req.serverCtx.mediaSourceScanCoordinator.add({
            libraryId: library.uuid,
            forceScan: !!req.query.forceScan,
          });
          if (!result) {
            logger.error(
              'Unable to schedule library ID %s for scanning',
              library.uuid,
            );
          }
        }
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
        const server = await req.serverCtx.mediaSourceDB.getById(
          tag(req.params.id),
        );

        if (isNil(server)) {
          return res.status(404).send();
        }

        const healthyPromise = match(server)
          .returnType<Promise<MediaSourceStatus>>()
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
          .with({ type: 'local' }, async (source) => {
            // TODO: Check all paths.
            let ok = true;
            for (const mediaPath of source.paths) {
              ok &&= await fileExists(mediaPath.path);
              if (!ok) {
                break;
              }
            }
            if (ok) {
              return { healthy: true };
            } else {
              return { healthy: false, status: 'unreachable' };
            }
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
        body: z
          .object({
            name: z.string().optional(),
            accessToken: z.string(),
            uri: z.string(),
            type: z.enum(['plex', 'jellyfin', 'emby']),
            username: z.string().optional(),
          })
          .or(
            z.object({
              type: z.literal('local'),
              paths: z.string().array().nonempty(),
            }),
          ),
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
              mediaSource: {
                ...req.body,
                uri: req.body.uri,
                userId: null,
                username: null,
                name: tag(req.body.name ?? 'unknown'),
                uuid: tag(v4()),
                libraries: [],
                paths: [],
                mediaType: null,
                replacePaths: [],
              },
            });

          healthyPromise = plex.checkServerStatus();
          break;
        }
        case 'jellyfin': {
          const jellyfin =
            await req.serverCtx.mediaSourceApiFactory.getJellyfinApiClient({
              mediaSource: {
                ...req.body,
                uri: req.body.uri,
                userId: null,
                username: null,
                name: tag(req.body.name ?? 'unknown'),
                uuid: tag(v4()),
                libraries: [],
                paths: [],
                mediaType: null,
                replacePaths: [],
              },
            });

          healthyPromise = jellyfin.ping();
          break;
        }
        case 'emby': {
          const emby =
            await req.serverCtx.mediaSourceApiFactory.getEmbyApiClient({
              mediaSource: {
                ...req.body,
                uri: req.body.uri,
                userId: null,
                username: null,
                name: tag(req.body.name ?? 'unknown'),
                uuid: tag(v4()),
                libraries: [],
                paths: [],
                mediaType: null,
                replacePaths: [],
              },
            });

          healthyPromise = emby.ping();
          break;
        }
        case 'local': {
          // TODO: Check all paths.
          const paths = req.body.paths;
          healthyPromise = run<Promise<MediaSourceStatus>>(async () => {
            let ok = true;
            for (const mediaPath of paths) {
              ok &&= await fileExists(mediaPath);
              if (!ok) {
                break;
              }
            }
            if (ok) {
              return { healthy: true };
            } else {
              return { healthy: false, status: 'unreachable' };
            }
          });
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
          await req.serverCtx.mediaSourceDB.deleteMediaSource(
            tag(req.params.id),
          );

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
          logger.error(e, 'Unable to update guide after lineup update %O');
        }

        return res.send();
      } catch (err) {
        logger.error(err);
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
        await req.serverCtx.mediaSourceDB.updateMediaSource(req.body);
        req.serverCtx.eventService.push({
          type: 'settings-update',
          message: `Media source ${req.body.name} updated.`,
          module: 'media-source',
          detail: {
            serverName: req.body.name,
            action: 'update',
          },
          level: 'info',
        });

        return res.status(200).send();
      } catch (err) {
        logger.error(err, 'Could not update media source.');
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
          500: z.string(),
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

  // TODO put this in its own class.
  function convertToApiMediaSource(
    entityLocker: EntityMutex,
    source: MarkOptional<MediaSourceWithRelations, 'libraries' | 'paths'>,
  ): MediaSourceSettings {
    return match(source)
      .returnType<MediaSourceSettings>()
      .with(
        { type: P.union('plex', 'jellyfin', 'emby') },
        (source) =>
          ({
            id: source.uuid,
            index: source.index,
            uri: source.uri,
            type: source.type,
            name: source.name,
            accessToken: source.accessToken,
            clientIdentifier: nullToUndefined(source.clientIdentifier),
            sendGuideUpdates: source.sendGuideUpdates ?? false,
            libraries: (source.libraries ?? []).map((library) => ({
              id: library.uuid,
              type: source.type,
              enabled: library.enabled,
              lastScannedAt: nullToUndefined(library.lastScannedAt)?.valueOf(),
              isLocked:
                entityLocker.isLibraryLocked(library) ||
                entityLocker.isMediaSourceLocked(source),
              name: library.name,
              externalKey: library.externalKey,
              mediaType: library.mediaType,
            })),
            userId: source.userId,
            username: source.username,
            pathReplacements: source.replacePaths.map((replace) => ({
              localPath: replace.localPath,
              serverPath: replace.serverPath,
            })),
          }) satisfies StrictExtract<
            MediaSourceSettings,
            { type: 'plex' | 'jellyfin' | 'emby' }
          >,
      )
      .with(
        { type: 'local', mediaType: P.nonNullable },
        (source) =>
          ({
            id: source.uuid,
            type: source.type,
            name: source.name,
            mediaType: source.mediaType,
            paths: source.libraries?.map((path) => path.externalKey) ?? [],
            libraries: (source.libraries ?? []).map((library) => ({
              id: library.uuid,
              type: source.type,
              enabled: library.enabled,
              lastScannedAt: nullToUndefined(library.lastScannedAt)?.valueOf(),
              isLocked:
                entityLocker.isLibraryLocked(library) ||
                entityLocker.isMediaSourceLocked(source),
              name: library.name,
              externalKey: library.externalKey,
              mediaType: library.mediaType,
            })),
            // N/A for local media sources
            pathReplacements: [],
          }) satisfies LocalMediaSource,
      )
      .otherwise(() => {
        logger.error('Encountered invalid media source: %O', source);
        throw new Error('Invalid media source: ' + JSON.stringify(source));
      });
  }
};
