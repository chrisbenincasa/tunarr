import {
  BasicIdParamSchema,
  InsertPlexServerRequestSchema,
  UpdatePlexServerRequestSchema,
} from '@tunarr/types/api';
import { PlexServerSettingsSchema } from '@tunarr/types/schemas';
import { isError, isNil, isObject } from 'lodash-es';
import z from 'zod';
import createLogger from '../logger.js';
import { Plex } from '../plex.js';
import { RouterPluginAsyncCallback } from '../types/serverType.js';
import { firstDefined } from '../util.js';

const logger = createLogger(import.meta);

export const plexServersRouter: RouterPluginAsyncCallback = async (
  fastify,
  // eslint-disable-next-line @typescript-eslint/require-await
) => {
  fastify.get(
    '/api/plex-servers',
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
    '/api/plex-servers/:id/status',
    {
      schema: {
        params: BasicIdParamSchema,
        response: {
          200: z.object({
            // TODO Change this, this is very stupid
            status: z.union([z.literal(1), z.literal(-1)]),
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
          status: s,
        });
      } catch (err) {
        logger.error(err);
        return res.status(500).send();
      }
    },
  );

  fastify.get(
    '/api/plex-servers/:id/foreignstatus',
    {
      schema: {
        params: BasicIdParamSchema,
        response: {
          200: z.object({
            // TODO Change this, this is very stupid
            status: z.union([z.literal(1), z.literal(-1)]),
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
          status: s,
        });
      } catch (err) {
        logger.error('%O', err);
        return res.status(500).send();
      }
    },
  );

  fastify.delete(
    '/api/plex-servers/:id',
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

        return res.send();
      } catch (err) {
        logger.error(err);
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
    '/api/plex-servers/:id',
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
    '/api/plex-servers',
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
};
