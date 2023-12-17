import { PlexServerSettingsSchema } from 'dizquetv-types/schemas';
import { isNil, isError, isObject, isUndefined } from 'lodash-es';
import z from 'zod';
import {
  PlexServerSettingsInsert,
  PlexServerSettingsUpdate,
} from '../dao/plexServerDb.js';
import createLogger from '../logger.js';
import { Plex } from '../plex.js';
import { RouterPluginCallback } from '../types/serverType.js';
import { firstDefined } from '../util.js';
import { PlexServerSettings } from 'dizquetv-types';

const logger = createLogger(import.meta);

export const plexServersRouter: RouterPluginCallback = (
  fastify,
  _opts,
  done,
) => {
  fastify.get(
    '/api/plex-servers',
    {
      schema: {
        response: {
          200: z.array(PlexServerSettingsSchema.readonly()).readonly(),
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

  fastify.post<{ Body: { name: string } }>(
    '/api/plex-servers/status',
    async (req, res) => {
      try {
        const servers = await req.serverCtx.plexServerDB.getById(req.body.name);
        if (isNil(servers)) {
          return res.status(404).send('Plex server not found.');
        }

        const plex = new Plex(servers);

        const s = await Promise.race([
          (async () => {
            return await plex.checkServerStatus();
          })(),
          new Promise((resolve) => {
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
        return res.status(500).send('error');
      }
    },
  );

  fastify.post<{ Body: PlexServerSettings }>(
    '/api/plex-servers/foreignstatus',
    async (req, res) => {
      try {
        const server = req.body;
        const plex = new Plex(server);
        const s = await Promise.race([
          (async () => {
            return await plex.checkServerStatus();
          })(),
          new Promise((resolve) => {
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
        return res.status(500).send('error');
      }
    },
  );

  fastify.delete<{ Body: { name: string } }>(
    '/api/plex-servers',
    async (req, res) => {
      let name = 'unknown';
      try {
        name = req.body.name;
        if (isUndefined(name)) {
          return res.status(400).send('Missing name');
        }
        const report = await req.serverCtx.plexServerDB.deleteServer(name);
        await res.send(report);
        req.serverCtx.eventService.push('settings-update', {
          message: `Plex server ${name} removed.`,
          module: 'plex-server',
          detail: {
            serverName: name,
            action: 'delete',
          },
          level: 'warn',
        });
      } catch (err) {
        logger.error(err);
        await res.status(500).send('error');
        req.serverCtx.eventService.push('settings-update', {
          message: 'Error deleting plex server.',
          module: 'plex-server',
          detail: {
            action: 'delete',
            serverName: name,
            error: isError(err) ? err.message : 'Missing',
          },
          level: 'danger',
        });
      }
    },
  );

  fastify.put<{ Body: PlexServerSettingsUpdate }>(
    '/api/plex-servers',
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
        await res.status(204).send('Plex server updated.');
        req.serverCtx.eventService.push('settings-update', {
          message: `Plex server ${req.body.name} updated. ${modifiedPrograms} programs modified, ${destroyedPrograms} programs deleted`,
          module: 'plex-server',
          detail: {
            serverName: req.body.name,
            action: 'update',
          },
          level: 'warning',
        });
      } catch (err) {
        logger.error('Could not update plex server.', err);
        await res.status(400).send('Could not add plex server.');
        req.serverCtx.eventService.push('settings-update', {
          message: 'Error updating plex server.',
          module: 'plex-server',
          detail: {
            action: 'update',
            serverName: firstDefined(req, 'body', 'name'),
            error: isObject(err) ? firstDefined(err, 'message') : 'unknown',
          },
          level: 'danger',
        });
      }
    },
  );

  fastify.post<{ Body: PlexServerSettingsInsert }>(
    '/api/plex-servers',
    async (req, res) => {
      try {
        await req.serverCtx.plexServerDB.addServer(req.body);
        await res.status(201).send('Plex server added.');
        req.serverCtx.eventService.push('settings-update', {
          message: `Plex server ${req.body.name} added.`,
          module: 'plex-server',
          detail: {
            serverName: req.body.name,
            action: 'add',
          },
          level: 'info',
        });
      } catch (err) {
        logger.error('Could not add plex server.', err);
        await res.status(400).send('Could not add plex server.');
        req.serverCtx.eventService.push('settings-update', {
          message: 'Error adding plex server.',
          module: 'plex-server',
          detail: {
            action: 'add',
            serverName: firstDefined(req, 'body', 'name'),
            error: isError(err) ? firstDefined(err, 'message') : 'unknown',
          },
          level: 'danger',
        });
      }
    },
  );

  done();
};
