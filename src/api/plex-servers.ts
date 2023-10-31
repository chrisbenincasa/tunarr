import express, { Request } from 'express';
import createLogger from '../logger.js';
import { isUndefined } from 'lodash-es';
import { Plex } from '../plex.js';
import { firstDefined } from '../util.js';

export const plexServersRouter = express.Router();

const logger = createLogger(import.meta);

plexServersRouter.get('/api(/v1)?/plex-servers', async (req: Request, res) => {
  try {
    res.json(req.ctx.dbAccess.plexServers().getAll());
  } catch (err) {
    logger.error(err);
    res.status(500).send('error');
  }
});

plexServersRouter.post(
  '/api(/v1)?/plex-servers/status',
  async (req: Request, res) => {
    try {
      let servers = req.ctx.dbAccess.plexServers().getById(req.body.name);
      if (isUndefined(servers)) {
        return res.status(404).send('Plex server not found.');
      }

      let plex = new Plex(servers);

      let s = await Promise.race([
        (async () => {
          return await plex.checkServerStatus();
        })(),
        new Promise((resolve, _) => {
          setTimeout(() => {
            resolve(-1);
          }, 60000);
        }),
      ]);

      return res.json({
        status: s,
      });
    } catch (err) {
      logger.error(err);
      return res.status(500).send('error');
    }
  },
);

plexServersRouter.post(
  '/api(/v1)?/plex-servers/foreignstatus',
  async (req, res) => {
    try {
      let server = req.body;
      let plex = new Plex(server);
      let s = await Promise.race([
        (async () => {
          return await plex.checkServerStatus();
        })(),
        new Promise((resolve, _reject) => {
          setTimeout(() => {
            resolve(-1);
          }, 60000);
        }),
      ]);
      res.send({
        status: s,
      });
    } catch (err) {
      logger.error(err);
      res.status(500).send('error');
    }
  },
);

plexServersRouter.delete(
  '/api(/v1)?/plex-servers',
  async (req: Request, res) => {
    let name = 'unknown';
    try {
      name = req.body.name;
      if (isUndefined(name)) {
        res.status(400).send('Missing name');
      }
      let report = await req.ctx.plexServerDB.deleteServer(name);
      res.send(report);
      req.ctx.eventService.push('settings-update', {
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
      res.status(500).send('error');
      req.ctx.eventService.push('settings-update', {
        message: 'Error deleting plex server.',
        module: 'plex-server',
        detail: {
          action: 'delete',
          serverName: name,
          error: isUndefined(err['message']) ? 'Missing' : err['message'],
        },
        level: 'danger',
      });
    }
  },
);

plexServersRouter.post('/api(/v1)?/plex-servers', async (req: Request, res) => {
  try {
    let report = await req.ctx.plexServerDB.updateServer(req.body);
    let modifiedPrograms = 0;
    let destroyedPrograms = 0;
    report.forEach((r) => {
      modifiedPrograms += r.modifiedPrograms;
      destroyedPrograms += r.destroyedPrograms;
    });
    res.status(204).send('Plex server updated.');
    req.ctx.eventService.push('settings-update', {
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
    res.status(400).send('Could not add plex server.');
    req.ctx.eventService.push('settings-update', {
      message: 'Error updating plex server.',
      module: 'plex-server',
      detail: {
        action: 'update',
        serverName: firstDefined(req, 'body', 'name'),
        error: firstDefined(err, 'message'),
      },
      level: 'danger',
    });
  }
});

plexServersRouter.put('/api(/v1)?/plex-servers', async (req, res) => {
  try {
    await req.ctx.plexServerDB.addServer(req.body);
    res.status(201).send('Plex server added.');
    req.ctx.eventService.push('settings-update', {
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
    res.status(400).send('Could not add plex server.');
    req.ctx.eventService.push('settings-update', {
      message: 'Error adding plex server.',
      module: 'plex-server',
      detail: {
        action: 'add',
        serverName: firstDefined(req, 'body', 'name'),
        error: firstDefined(err, 'message'),
      },
      level: 'danger',
    });
  }
});
