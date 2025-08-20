import { defaultXmlTvSettings } from '@/db/SettingsDB.js';
import { serverOptions } from '@/globals.js';
import { GlobalScheduler } from '@/services/Scheduler.js';
import { UpdateXmlTvTask } from '@/tasks/UpdateXmlTvTask.js';
import type { RouterPluginCallback } from '@/types/serverType.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import { BaseErrorSchema } from '@tunarr/types/api';
import { XmlTvSettingsSchema } from '@tunarr/types/schemas';
import { isError } from 'lodash-es';
import { z } from 'zod/v4';

export const xmlTvSettingsRouter: RouterPluginCallback = (
  fastify,
  _opts,
  done,
) => {
  const logger = LoggerFactory.child({
    caller: import.meta,
    className: 'XmlTvSettingsRouter',
  });

  fastify.get(
    '/xmltv-settings',
    {
      schema: {
        tags: ['Settings'],
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
        logger.error(err);
        return res.status(500).send('error');
      }
    },
  );

  fastify.put(
    '/xmltv-settings',
    {
      schema: {
        tags: ['Settings'],
        body: XmlTvSettingsSchema.partial(),
        response: {
          200: XmlTvSettingsSchema,
          500: BaseErrorSchema,
        },
      },
    },
    async (req, res) => {
      try {
        const settings = req.body;
        let xmltv = req.serverCtx.settings.xmlTvSettings();
        await req.serverCtx.settings.updateSettings('xmltv', {
          refreshHours:
            (settings.refreshHours ?? 0) < 1 ? 1 : settings.refreshHours!,
          enableImageCache: settings.enableImageCache === true,
          outputPath: xmltv.outputPath,
          programmingHours: settings.programmingHours ?? 12,
          useShowPoster: settings.useShowPoster ?? false,
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
            error: isError(err) ? err.message : 'unknown',
          },
          level: 'error',
        });
        return res.status(500).send({ message: 'error' });
      }
    },
  );

  fastify.post(
    '/xmltv-settings',
    {
      schema: {
        tags: ['Settings'],
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
          defaultXmlTvSettings(serverOptions().databaseDirectory),
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
            error: isError(err) ? err.message : 'unknown',
          },
          level: 'error',
        });
        return res.status(500).send('error');
      }
    },
  );

  done();
};
