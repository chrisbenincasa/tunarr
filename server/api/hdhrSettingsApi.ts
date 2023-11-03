import { FastifyPluginCallback } from 'fastify';
import { isError } from 'lodash-es';
import { HdhrSettings } from '../dao/db.js';
import createLogger from '../logger.js';
import { firstDefined } from '../util.js';

const logger = createLogger(import.meta);

export const hdhrSettingsRouter: FastifyPluginCallback = (
  fastify,
  _opts,
  done,
) => {
  fastify.get('/api/hdhr-settings', (req, res) => {
    try {
      const hdhr = req.serverCtx.dbAccess.hdhrSettings();
      return res.send(hdhr);
    } catch (err) {
      logger.error(err);
      return res.status(500).send('error');
    }
  });

  fastify.put<{ Body: HdhrSettings }>(
    '/api/hdhr-settings',
    async (req, res) => {
      try {
        await req.serverCtx.dbAccess.updateSettings('hdhr', req.body);
        const hdhr = req.serverCtx.dbAccess.hdhrSettings();
        await res.send(hdhr);
        req.serverCtx.eventService.push('settings-update', {
          message: 'HDHR configuration updated.',
          module: 'hdhr',
          detail: {
            action: 'update',
          },
          level: 'info',
        });
      } catch (err) {
        logger.error(err);
        await res.status(500).send('error');
        req.serverCtx.eventService.push('settings-update', {
          message: 'Error updating HDHR configuration',
          module: 'hdhr',
          detail: {
            action: 'action',
            error: isError(err) ? firstDefined(err, 'message') : 'unknown',
          },
          level: 'danger',
        });
      }
    },
  );

  fastify.post('/api/hdhr-settings', async (req, res) => {
    try {
      await req.serverCtx.dbAccess.updateSettings('hdhr', {
        // _id: req.body._id,
        tunerCount: 1,
        autoDiscoveryEnabled: true,
      });
      const hdhr = req.serverCtx.dbAccess.hdhrSettings();
      await res.send(hdhr);
      req.serverCtx.eventService.push('settings-update', {
        message: 'HDHR configuration reset.',
        module: 'hdhr',
        detail: {
          action: 'reset',
        },
        level: 'warning',
      });
    } catch (err) {
      logger.error(err);
      await res.status(500).send('error');
      req.serverCtx.eventService.push('settings-update', {
        message: 'Error reseting HDHR configuration',
        module: 'hdhr',
        detail: {
          action: 'reset',
          error: isError(err) ? firstDefined(err, 'message') : 'unknown',
        },
        level: 'danger',
      });
    }
  });

  done();
};
