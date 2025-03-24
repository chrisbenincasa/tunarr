import { defaultXmlTvSettings } from '@/db/SettingsDB.js';
import { serverOptions } from '@/globals.js';
import { GlobalScheduler } from '@/services/Scheduler.js';
import { UpdateXmlTvTask } from '@/tasks/UpdateXmlTvTask.js';
import type { ServerType } from '@/types/serverType.js';
import { Logger } from '@/util/logging/LoggerFactory.js';
import type { XmlTvSettings } from '@tunarr/types';
import { BaseErrorSchema } from '@tunarr/types/api';
import { XmlTvSettingsSchema } from '@tunarr/types/schemas';
import { inject, injectable } from 'inversify';
import { isError } from 'lodash-es';
import { z } from 'zod';
import { KEYS } from '../types/inject.ts';
import { Controller } from './Controller.ts';

@injectable()
export class XmlTvSettingsController extends Controller {
  constructor(@inject(KEYS.Logger) logger: Logger) {
    super(logger);
  }

  protected prefix = '/settings/xmltv';

  // eslint-disable-next-line @typescript-eslint/require-await
  protected async configure(fastify: ServerType): Promise<void> {
    fastify.get(
      '',
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
        return res.send(req.serverCtx.settings.xmlTvSettings());
      },
    );

    fastify.put(
      '',
      {
        schema: {
          tags: ['Settings'],
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
          await GlobalScheduler.getScheduledJob(UpdateXmlTvTask.ID).runNow(
            false,
          );
          return res.send(xmltv);
        } catch (err) {
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

          throw err;
        }
      },
    );

    fastify.post(
      '',
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

          await GlobalScheduler.getScheduledJob(UpdateXmlTvTask.ID).runNow(
            false,
          );
          return res.send(xmltv);
        } catch (err) {
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

          throw err;
        }
      },
    );
  }
}
