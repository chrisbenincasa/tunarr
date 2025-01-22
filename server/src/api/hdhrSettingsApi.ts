import type { RouterPluginCallback } from '@/types/serverType.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import type { HdhrSettings } from '@tunarr/types';
import { BaseErrorSchema } from '@tunarr/types/api';
import { HdhrSettingsSchema } from '@tunarr/types/schemas';
import { isError } from 'lodash-es';
import type { DeepWritable } from 'ts-essentials';

export const hdhrSettingsRouter: RouterPluginCallback = (
  fastify,
  _opts,
  done,
) => {
  const logger = LoggerFactory.child({
    caller: import.meta,
    className: 'HdhrSettingsApi',
  });

  fastify.get(
    '/hdhr-settings',
    {
      schema: {
        tags: ['Settings'],
        response: {
          200: HdhrSettingsSchema,
          500: BaseErrorSchema,
        },
      },
    },
    async (req, res) => {
      try {
        const hdhr = req.serverCtx.settings.hdhrSettings();
        return res.send(hdhr as DeepWritable<HdhrSettings>);
      } catch (err) {
        logger.error(err);
        return res.status(500).send({ message: 'error' });
      }
    },
  );

  fastify.put(
    '/hdhr-settings',
    {
      schema: {
        tags: ['Settings'],
        body: HdhrSettingsSchema,
        response: {
          200: HdhrSettingsSchema,
          500: BaseErrorSchema,
        },
      },
    },
    async (req, res) => {
      try {
        await req.serverCtx.settings.updateSettings('hdhr', req.body);
        const hdhr = req.serverCtx.settings.hdhrSettings();
        req.serverCtx.eventService.push({
          type: 'settings-update',
          message: 'HDHR configuration updated.',
          module: 'hdhr',
          detail: {
            action: 'update',
          },
          level: 'success',
        });
        await res.send(hdhr);
      } catch (err) {
        logger.error(err);
        await res.status(500).send({ message: 'error' });
        req.serverCtx.eventService.push({
          type: 'settings-update',
          message: 'Error updating HDHR configuration',
          module: 'hdhr',
          detail: {
            action: 'action',
            error: isError(err) ? err.message : 'unknown',
          },
          level: 'error',
        });
      }
    },
  );

  fastify.post(
    '/hdhr-settings',
    {
      schema: {
        tags: ['Settings'],
        response: {
          200: HdhrSettingsSchema,
          500: BaseErrorSchema,
        },
      },
    },
    async (req, res) => {
      try {
        await req.serverCtx.settings.updateSettings('hdhr', {
          // _id: req.body._id,
          tunerCount: 1,
          autoDiscoveryEnabled: true,
        });
        const hdhr =
          req.serverCtx.settings.hdhrSettings() as DeepWritable<HdhrSettings>;
        req.serverCtx.eventService.push({
          type: 'settings-update',
          message: 'HDHR configuration reset.',
          module: 'hdhr',
          detail: {
            action: 'reset',
          },
          level: 'warning',
        });
        return res.send(hdhr);
      } catch (err) {
        logger.error(err);
        req.serverCtx.eventService.push({
          type: 'settings-update',
          message: 'Error reseting HDHR configuration',
          module: 'hdhr',
          detail: {
            action: 'reset',
            error: isError(err) ? err.message : 'unknown',
          },
          level: 'error',
        });
        return res.status(500).send({ message: 'error' });
      }
    },
  );

  done();
};
