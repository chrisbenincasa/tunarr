import { XmlTvSettings } from '@tunarr/types';
import { BaseErrorSchema } from '@tunarr/types/api';
import { XmlTvSettingsSchema } from '@tunarr/types/schemas';
import { isError } from 'lodash-es';
import { z } from 'zod';
import { defaultXmlTvSettings } from '../dao/settings.js';
import { serverOptions } from '../globals.js';
import createLogger from '../logger.js';
import { GlobalScheduler } from '../services/scheduler.js';
import { UpdateXmlTvTask } from '../tasks/updateXmlTvTask.js';
import { RouterPluginCallback } from '../types/serverType.js';
import { firstDefined } from '../util.js';

const logger = createLogger(import.meta);

export const xmlTvSettingsRouter: RouterPluginCallback = (
  fastify,
  _opts,
  done,
) => {
  fastify.get(
    '/api/xmltv-settings',
    {
      schema: {
        response: {
          200: XmlTvSettingsSchema,
          500: z.string(),
        },
      },
    },
    async (req, res) => {
      try {
        return res.send(req.serverCtx.settings.xmlTvSettings());
      } catch (err) {
        return res.status(500).send('error');
      }
    },
  );

  fastify.put(
    '/api/xmltv-settings',
    {
      schema: {
        response: {
          200: XmlTvSettingsSchema,
          500: BaseErrorSchema,
        },
      },
    },
    async (req, res) => {
      try {
        const settings = req.body as Partial<XmlTvSettings>;
        let xmltv = req.serverCtx.settings.xmlTvSettings();
        await req.serverCtx.settings.updateSettings('xmltv', {
          refreshHours:
            (settings.refreshHours ?? 0) < 1 ? 1 : settings.refreshHours!,
          enableImageCache: settings.enableImageCache === true,
          outputPath: xmltv.outputPath,
          programmingHours: settings.programmingHours ?? 12,
        });
        xmltv = req.serverCtx.settings.xmlTvSettings();
        req.serverCtx.eventService.push({
          type: 'settings-update',
          message: 'XMLTV settings updated',
          module: 'xmltv',
          detail: {
            action: 'update',
          },
          level: 'success',
        });
        await GlobalScheduler.getScheduledJob(UpdateXmlTvTask.ID).runNow(false);
        return res.send(xmltv);
      } catch (err) {
        logger.error(err);
        req.serverCtx.eventService.push({
          type: 'settings-update',
          message: 'Error updating XMLTV configuration',
          module: 'xmltv',
          detail: {
            action: 'update',
            error: isError(err) ? firstDefined(err, 'message') : 'unknown',
          },
          level: 'error',
        });
        return res.status(500).send({ message: 'error' });
      }
    },
  );

  fastify.post(
    '/api/xmltv-settings',
    {
      schema: {
        response: {
          200: XmlTvSettingsSchema,
          500: z.string(),
        },
      },
    },
    async (req, res) => {
      try {
        await req.serverCtx.settings.updateSettings(
          'xmltv',
          defaultXmlTvSettings(serverOptions().database),
        );
        const xmltv = req.serverCtx.settings.xmlTvSettings();
        req.serverCtx.eventService.push({
          type: 'settings-update',
          message: 'XMLTV settings reset',
          module: 'xmltv',
          detail: {
            action: 'reset',
          },
          level: 'warning',
        });

        await GlobalScheduler.getScheduledJob(UpdateXmlTvTask.ID).runNow(false);
        return res.send(xmltv);
      } catch (err) {
        logger.error(err);
        req.serverCtx.eventService.push({
          type: 'settings-update',
          message: 'Error reseting XMLTV configuration',
          module: 'xmltv',
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
