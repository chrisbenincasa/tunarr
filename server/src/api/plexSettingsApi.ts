import { PlexStreamSettings, defaultPlexStreamSettings } from '@tunarr/types';
import { PlexStreamSettingsSchema } from '@tunarr/types/schemas';
import { isError } from 'lodash-es';
import { DeepWritable } from 'ts-essentials';
import { z } from 'zod';
import createLogger from '../logger.js';
import { RouterPluginCallback } from '../types/serverType.js';
import { firstDefined } from '../util';
const logger = createLogger(import.meta);

export const plexSettingsRouter: RouterPluginCallback = (
  fastify,
  _opts,
  done,
) => {
  fastify.get(
    '/api/plex-settings',
    {
      schema: {
        response: {
          200: PlexStreamSettingsSchema,
          500: z.string(),
        },
      },
    },
    async (req, res) => {
      try {
        const plex: PlexStreamSettings =
          req.serverCtx.settings.plexSettings() as DeepWritable<PlexStreamSettings>;
        // This is super hackyyyyyy
        return res.send(plex);
      } catch (err) {
        logger.error(err);
        return res.status(500).send('error');
      }
    },
  );

  fastify.put(
    '/api/plex-settings',
    {
      schema: {
        body: PlexStreamSettingsSchema,
        response: {
          200: PlexStreamSettingsSchema,
          500: z.string(),
        },
      },
    },
    async (req, res) => {
      try {
        await req.serverCtx.settings.updateSettings('plexStream', req.body);
        const plex =
          req.serverCtx.settings.plexSettings() as DeepWritable<PlexStreamSettings>;
        req.serverCtx.eventService.push({
          type: 'settings-update',
          message: 'Plex configuration updated.',
          module: 'plex',
          detail: {
            action: 'update',
          },
          level: 'success',
        });
        return res.send(plex);
      } catch (err) {
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
        return res.status(500).send('error');
      }
    },
  );

  fastify.post(
    '/api/plex-settings',
    {
      schema: {
        response: {
          200: PlexStreamSettingsSchema,
          500: z.string(),
        },
      },
    },
    async (req, res) => {
      // RESET
      try {
        await req.serverCtx.settings.updateSettings(
          'plexStream',
          defaultPlexStreamSettings,
        );
        const plex =
          req.serverCtx.settings.plexSettings() as DeepWritable<PlexStreamSettings>;
        req.serverCtx.eventService.push({
          type: 'settings-update',
          message: 'Plex configuration reset.',
          module: 'plex',
          detail: {
            action: 'reset',
          },
          level: 'warning',
        });
        return res.send(plex);
      } catch (err) {
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
        return res.status(500).send('error');
      }
    },
  );

  done();
};
