import { FastifyPluginCallback } from 'fastify';
import { isError } from 'lodash-es';
import { XmlTvSettings, defaultXmlTvSettings } from '../dao/settings.js';
import createLogger from '../logger.js';
import { scheduledJobsById } from '../services/scheduler.js';
import { firstDefined } from '../util.js';
import { serverOptions } from '../globals.js';

const logger = createLogger(import.meta);

export const xmlTvSettingsRouter: FastifyPluginCallback = (
  fastify,
  _opts,
  done,
) => {
  fastify.get('/api/xmltv-settings', async (req, res) => {
    try {
      console.log(req.serverCtx.settings.xmlTvSettings());
      return res.send(req.serverCtx.settings.xmlTvSettings());
    } catch (err) {
      logger.error(err);
      return res.status(500).send('error');
    }
  });

  // const xmltvSchema = z.object({
  //   refreshHours: z.number().gte(1)
  // })

  fastify.put('/api/xmltv-settings', async (req, res) => {
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
      await res.send(xmltv);
      req.serverCtx.eventService.push({
        type: 'settings-update',
        message: 'XMLTV settings updated',
        module: 'xmltv',
        detail: {
          action: 'update',
        },
        level: 'success',
      });
      await updateXmltv();
    } catch (err) {
      logger.error(err);
      await res.status(500).send('error');

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
    }
  });

  fastify.post('/api/xmltv-settings', async (req, res) => {
    try {
      await req.serverCtx.settings.updateSettings(
        'xmltv',
        defaultXmlTvSettings(serverOptions().database),
      );
      const xmltv = req.serverCtx.settings.xmlTvSettings();
      await res.send(xmltv);
      req.serverCtx.eventService.push({
        type: 'settings-update',
        message: 'XMLTV settings reset',
        module: 'xmltv',
        detail: {
          action: 'reset',
        },
        level: 'warning',
      });

      await updateXmltv();
    } catch (err) {
      logger.error(err);
      await res.status(500).send('error');
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
    }
  });

  done();
};

async function updateXmltv() {
  await scheduledJobsById['update-xmltv']?.runNow();
}
