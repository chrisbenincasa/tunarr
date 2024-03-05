import { FastifyPluginCallback } from 'fastify';
import { isError } from 'lodash-es';
import { PlexStreamSettings } from '../dao/settings.js';
import createLogger from '../logger.js';
import { firstDefined } from '../util.js';
import { defaultPlexStreamSettings } from '@tunarr/types';

const logger = createLogger(import.meta);

export const plexSettingsRouter: FastifyPluginCallback = (
  fastify,
  _opts,
  done,
) => {
  fastify.get('/api/plex-settings', (req, res) => {
    try {
      const plex = req.serverCtx.settings.plexSettings();
      return res.send(plex);
    } catch (err) {
      logger.error(err);
      return res.status(500).send('error');
    }
  });

  fastify.put<{ Body: PlexStreamSettings }>(
    '/api/plex-settings',
    async (req, res) => {
      try {
        await req.serverCtx.settings.updateSettings('plexStream', req.body);
        const plex = req.serverCtx.settings.plexSettings();
        await res.send(plex);
        req.serverCtx.eventService.push({
          type: 'settings-update',
          message: 'Plex configuration updated.',
          module: 'plex',
          detail: {
            action: 'update',
          },
          level: 'success',
        });
      } catch (err) {
        logger.error(err);
        await res.status(500).send('error');
        req.serverCtx.eventService.push({
          type: 'settings-update',
          message: 'Error updating Plex configuration',
          module: 'plex',
          detail: {
            action: 'update',
            error: isError(err) ? firstDefined(err, 'message') : 'unknown',
          },
          level: 'error',
        });
      }
    },
  );

  fastify.post('/api/plex-settings', async (req, res) => {
    // RESET
    try {
      await req.serverCtx.settings.updateSettings(
        'plexStream',
        defaultPlexStreamSettings,
      );
      const plex = req.serverCtx.settings.plexSettings();
      await res.send(plex);
      req.serverCtx.eventService.push({
        type: 'settings-update',
        message: 'Plex configuration reset.',
        module: 'plex',
        detail: {
          action: 'reset',
        },
        level: 'warning',
      });
    } catch (err) {
      logger.error(err);
      await res.status(500).send('error');

      req.serverCtx.eventService.push({
        type: 'settings-update',
        message: 'Error reseting Plex configuration',
        module: 'plex',
        detail: {
          action: 'reset',
          error: isError(err) ? firstDefined(err, 'message') : 'unknown',
        },
        level: 'error',
      });
    }
  });

  done();
};
