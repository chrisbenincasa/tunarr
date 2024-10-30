import { MediaSourceSettings, tag } from '@tunarr/types';
import {
  BaseErrorSchema,
  BasicIdParamSchema,
  InsertMediaSourceRequestSchema,
  UpdateMediaSourceRequestSchema,
} from '@tunarr/types/api';
import { MediaSourceSettingsSchema } from '@tunarr/types/schemas';
import { isError, isNil, isObject, map } from 'lodash-es';
import { match } from 'ts-pattern';
import z from 'zod';
import { MediaSourceType } from '../dao/entities/MediaSource.js';
import { numberToBoolean } from '../dao/sqliteUtil.js';
import { MediaSourceApiFactory } from '../external/MediaSourceApiFactory.js';
import { JellyfinApiClient } from '../external/jellyfin/JellyfinApiClient.js';
import { PlexApiClient } from '../external/plex/PlexApiClient.js';
import { GlobalScheduler } from '../services/scheduler.js';
import { UpdateXmlTvTask } from '../tasks/UpdateXmlTvTask.js';
import { RouterPluginAsyncCallback } from '../types/serverType.js';
import { firstDefined, nullToUndefined, wait } from '../util/index.js';
import { LoggerFactory } from '../util/logging/LoggerFactory.js';

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
        response: {
          200: z.array(MediaSourceSettingsSchema),
          500: z.string(),
        },
      },
    },
    async (req, res) => {
      try {
        const servers = await req.serverCtx.mediaSourceDB.getAll();
        return res.send(
          map(
            servers,
            (dao) =>
              ({
                // ...dao,
                id: tag(dao.uuid),
                index: dao.index,
                uri: dao.uri,
                type: dao.type,
                name: dao.name,
                accessToken: dao.accessToken,
                clientIdentifier: nullToUndefined(dao.clientIdentifier),
                sendChannelUpdates: numberToBoolean(dao.sendChannelUpdates),
                sendGuideUpdates: numberToBoolean(dao.sendGuideUpdates),
              }) satisfies MediaSourceSettings,
          ),
        );
      } catch (err) {
        logger.error(err);
        return res.status(500).send('error');
      }
    },
  );

  fastify.get(
    '/media-sources/:id/status',
    {
      schema: {
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
          .with({ type: 'plex' }, (server) => {
            return new PlexApiClient(server).checkServerStatus();
          })
          .with({ type: 'jellyfin' }, (server) => {
            return new JellyfinApiClient({
              url: server.uri,
              apiKey: server.accessToken,
              name: server.name,
            })
              .getSystemInfo()
              .then(() => true)
              .catch(() => false);
          })
          .exhaustive();

        const status = await Promise.race([
          healthyPromise,
          new Promise<false>((resolve) => {
            setTimeout(() => {
              resolve(false);
            }, 60000);
          }),
        ]);

        return res.send({
          healthy: status,
        });
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
        body: z.object({
          name: z.string().optional(),
          accessToken: z.string(),
          uri: z.string(),
          type: z.union([z.literal('plex'), z.literal('jellyfin')]),
          username: z.string().optional(),
        }),
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
      let healthyPromise: Promise<boolean>;
      switch (req.body.type) {
        case 'plex': {
          const plex = new PlexApiClient({
            ...req.body,
            name: req.body.name ?? 'unknown',
            clientIdentifier: null,
          });

          healthyPromise = plex.checkServerStatus();
          break;
        }
        case 'jellyfin': {
          const jellyfin = new JellyfinApiClient({
            url: req.body.uri,
            name: req.body.name ?? 'unknown',
            apiKey: req.body.accessToken,
          });

          healthyPromise = jellyfin.ping();
          break;
        }
      }

      const healthy = await Promise.race([
        healthyPromise,
        new Promise<false>((resolve) => {
          setTimeout(() => {
            resolve(false);
          }, 60000);
        }),
      ]);

      return res.send({
        healthy,
      });
    },
  );

  fastify.delete(
    '/media-sources/:id',
    {
      schema: {
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
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          modifiedPrograms += r.modifiedPrograms;
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
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
            serverName: firstDefined(req, 'body', 'name'),
            error: isObject(err) ? firstDefined(err, 'message') : 'unknown',
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
            error: isError(err) ? firstDefined(err, 'message') : 'unknown',
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
        querystring: z.object({
          serverName: z.string(),
        }),
        response: {
          200: z.object({
            healthy: z.boolean(),
          }),
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

        const plex = MediaSourceApiFactory().get(server);

        const s = await Promise.race([
          plex.checkServerStatus(),
          wait(15000).then(() => false),
        ]);

        return res.send({
          healthy: s,
        });
      } catch (err) {
        return res.status(500).send({
          message: isError(err) ? err.message : 'Unknown error occurred',
        });
      }
    },
  );
};
