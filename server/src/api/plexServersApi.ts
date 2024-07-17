import {
  BaseErrorSchema,
  BasicIdParamSchema,
  InsertPlexServerRequestSchema,
  UpdatePlexServerRequestSchema,
} from '@tunarr/types/api';
import { PlexServerSettingsSchema } from '@tunarr/types/schemas';
import { isError, isNil, isObject } from 'lodash-es';
import z from 'zod';
import { PlexServerSettings } from '../dao/entities/PlexServerSettings.js';
import { Plex } from '../external/plex.js';
import { PlexApiFactory } from '../external/PlexApiFactory.js';
import { GlobalScheduler } from '../services/scheduler.js';
import { UpdateXmlTvTask } from '../tasks/UpdateXmlTvTask.js';
import { RouterPluginAsyncCallback } from '../types/serverType.js';
import { firstDefined, wait } from '../util/index.js';
import { LoggerFactory } from '../util/logging/LoggerFactory.js';

export const plexServersRouter: RouterPluginAsyncCallback = async (
  fastify,
  // eslint-disable-next-line @typescript-eslint/require-await
) => {
  const logger = LoggerFactory.child({ caller: import.meta });

  fastify.get(
    '/plex-servers',
    {
      schema: {
        response: {
          200: z.array(PlexServerSettingsSchema),
          500: z.string(),
        },
      },
    },
    async (req, res) => {
      try {
        const servers = await req.serverCtx.plexServerDB.getAll();
        const dtos = servers.map((server) => server.toDTO());
        return res.send(dtos);
      } catch (err) {
        logger.error(err);
        return res.status(500).send('error');
      }
    },
  );

  fastify.get(
    '/plex-servers/:id/status',
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
        const server = await req.serverCtx.plexServerDB.getById(req.params.id);

        if (isNil(server)) {
          return res.status(404).send();
        }

        const plex = new Plex(server);

        const s: 1 | -1 = await Promise.race([
          (async () => {
            return await plex.checkServerStatus();
          })(),
          new Promise<-1>((resolve) => {
            setTimeout(() => {
              resolve(-1);
            }, 60000);
          }),
        ]);

        return res.send({
          healthy: s === 1,
        });
      } catch (err) {
        logger.error(err);
        return res.status(500).send();
      }
    },
  );

  fastify.post(
    '/plex-servers/foreignstatus',
    {
      schema: {
        body: z.object({
          name: z.string().optional(),
          accessToken: z.string(),
          uri: z.string(),
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
      try {
        const plex = new Plex({
          ...req.body,
          name: req.body.name ?? 'unknown',
        });

        const s: boolean = await Promise.race([
          (async () => {
            const res = await plex.checkServerStatus();
            return res === 1;
          })(),
          new Promise<false>((resolve) => {
            setTimeout(() => {
              resolve(false);
            }, 60000);
          }),
        ]);

        return res.send({
          healthy: s,
        });
      } catch (err) {
        logger.error('%O', err);
        return res.status(500).send();
      }
    },
  );

  fastify.delete(
    '/plex-servers/:id',
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
        const { deletedServer } = await req.serverCtx.plexServerDB.deleteServer(
          req.params.id,
        );

        // Are these useful? What do they even do?
        req.serverCtx.eventService.push({
          type: 'settings-update',
          message: `Plex server ${deletedServer.name} removed.`,
          module: 'plex-server',
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
          message: 'Error deleting plex server.',
          module: 'plex-server',
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
    '/plex-servers/:id',
    {
      schema: {
        params: BasicIdParamSchema,
        body: UpdatePlexServerRequestSchema,
        response: {
          200: z.void(),
          500: z.void(),
        },
      },
    },
    async (req, res) => {
      try {
        const report = await req.serverCtx.plexServerDB.updateServer(req.body);
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
          message: `Plex server ${req.body.name} updated. ${modifiedPrograms} programs modified, ${destroyedPrograms} programs deleted`,
          module: 'plex-server',
          detail: {
            serverName: req.body.name,
            action: 'update',
          },
          level: 'warning',
        });

        return res.status(200).send();
      } catch (err) {
        logger.error('Could not update plex server. ', err);
        req.serverCtx.eventService.push({
          type: 'settings-update',
          message: 'Error updating plex server.',
          module: 'plex-server',
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
    '/plex-servers',
    {
      schema: {
        body: InsertPlexServerRequestSchema,
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
        const newServerId = await req.serverCtx.plexServerDB.addServer(
          req.body,
        );
        req.serverCtx.eventService.push({
          type: 'settings-update',
          message: `Plex server ${req.body.name} added.`,
          module: 'plex-server',
          detail: {
            serverId: newServerId,
            serverName: req.body.name,
            action: 'add',
          },
          level: 'success',
        });
        return res.status(201).send({ id: newServerId });
      } catch (err) {
        logger.error('Could not add plex server.', err);
        req.serverCtx.eventService.push({
          type: 'settings-update',
          message: 'Error adding plex server.',
          module: 'plex-server',
          detail: {
            action: 'add',
            serverName: firstDefined(req, 'body', 'name'),
            error: isError(err) ? firstDefined(err, 'message') : 'unknown',
          },
          level: 'error',
        });
        return res.status(400).send('Could not add plex server.');
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
        const server = await req.entityManager
          .repo(PlexServerSettings)
          .findOne({ name: req.query.serverName });

        if (isNil(server)) {
          return res.status(404).send({ message: 'Plex server not found.' });
        }

        const plex = PlexApiFactory().get(server);

        const s = await Promise.race([
          plex.checkServerStatus().then((res) => res === 1),
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
