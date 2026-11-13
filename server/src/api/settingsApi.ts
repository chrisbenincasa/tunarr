import type { GlobalMediaSourceSettings } from '@tunarr/types/schemas';
import { GlobalMediaSourceSettingsSchema } from '@tunarr/types/schemas';
import type { DeepWritable } from 'ts-essentials';
import z from 'zod';
import { scheduleLibraryScanJobs } from '../services/libraryScanSchedule.ts';
import type { RouterPluginAsyncCallback } from '../types/serverType.js';
import { isValidCronExpression } from '../util/schedulingUtil.ts';

// eslint-disable-next-line @typescript-eslint/require-await
export const settingsApi: RouterPluginAsyncCallback = async (fastify) => {
  fastify.get(
    '/settings/media-source',
    {
      schema: {
        tags: ['Settings'],
        response: {
          200: GlobalMediaSourceSettingsSchema,
        },
      },
    },
    async (req, res) => {
      const settings = req.serverCtx.settings.globalMediaSourceSettings();
      return res.send(settings as DeepWritable<GlobalMediaSourceSettings>);
    },
  );

  fastify.put(
    '/settings/media-source',
    {
      schema: {
        tags: ['Settings'],
        body: GlobalMediaSourceSettingsSchema,
        response: {
          200: GlobalMediaSourceSettingsSchema,
          400: z.object({ message: z.string() }),
        },
      },
    },
    async (req, res) => {
      const { scanSchedule } = req.body;
      if (
        scanSchedule.type === 'cron' &&
        !isValidCronExpression(scanSchedule.cron)
      ) {
        return res.status(400).send({
          message: `"${scanSchedule.cron}" is not a valid cron expression.`,
        });
      }

      await req.serverCtx.settings.updateSettings('mediaSource', req.body);
      const settings = req.serverCtx.settings.globalMediaSourceSettings();
      scheduleLibraryScanJobs(settings.scanSchedule);
      return res.send(settings as DeepWritable<GlobalMediaSourceSettings>);
    },
  );
};
