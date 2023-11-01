import express from 'express';
import createLogger from '../logger.js';
import { firstDefined } from '../util.js';
import { defaultPlexStreamSettings } from '../dao/db.js';

const logger = createLogger(import.meta);

export const plexSettingsRouter = express.Router();

plexSettingsRouter.get('/api/plex-settings', (req, res) => {
  try {
    let plex = req.ctx.dbAccess.plexSettings();
    res.send(plex);
  } catch (err) {
    logger.error(err);
    res.status(500).send('error');
  }
});
plexSettingsRouter.put('/api/plex-settings', async (req, res) => {
  try {
    await req.ctx.dbAccess.updateSettings('plexStream', req.body);
    let plex = req.ctx.dbAccess.plexSettings();
    res.send(plex);
    req.ctx.eventService.push('settings-update', {
      message: 'Plex configuration updated.',
      module: 'plex',
      detail: {
        action: 'update',
      },
      level: 'info',
    });
  } catch (err) {
    logger.error(err);
    res.status(500).send('error');
    req.ctx.eventService.push('settings-update', {
      message: 'Error updating Plex configuration',
      module: 'plex',
      detail: {
        action: 'update',
        error: firstDefined(err, 'message'),
      },
      level: 'danger',
    });
  }
});
plexSettingsRouter.post('/api/plex-settings', async (req, res) => {
  // RESET
  try {
    await req.ctx.dbAccess.updateSettings(
      'plexStream',
      defaultPlexStreamSettings,
    );
    let plex = req.ctx.dbAccess.plexSettings();
    res.send(plex);
    req.ctx.eventService.push('settings-update', {
      message: 'Plex configuration reset.',
      module: 'plex',
      detail: {
        action: 'reset',
      },
      level: 'warning',
    });
  } catch (err) {
    logger.error(err);
    res.status(500).send('error');

    req.ctx.eventService.push('settings-update', {
      message: 'Error reseting Plex configuration',
      module: 'plex',
      detail: {
        action: 'reset',
        error: firstDefined(err, 'message'),
      },
      level: 'danger',
    });
  }
});
