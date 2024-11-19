import { serverOptions } from '@/globals.js';
import { RouterPluginCallback } from '@/types/serverType.js';
import { firstDefined } from '@/util/index.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import { sanitizeForExec } from '@/util/strings.js';
import { defaultFfmpegSettings } from '@tunarr/types';
import { FfmpegSettingsSchema } from '@tunarr/types/schemas';
import { isError, merge, omit } from 'lodash-es';
import { z } from 'zod';

export const ffmpegSettingsRouter: RouterPluginCallback = (
  fastify,
  _opts,
  done,
) => {
  const logger = LoggerFactory.child({
    caller: import.meta,
    className: 'FfmpegSettingsApi',
  });

  fastify.get('/ffmpeg-settings', (req, res) => {
    try {
      const ffmpeg = req.serverCtx.settings.ffmpegSettings();
      return res.send(ffmpeg);
    } catch (err) {
      logger.error(err);
      return res.status(500).send('error');
    }
  });

  fastify.put(
    '/ffmpeg-settings',
    {
      schema: {
        body: FfmpegSettingsSchema,
        response: {
          200: FfmpegSettingsSchema,
          400: z.string(),
          500: z.string(),
        },
      },
    },
    async (req, res) => {
      try {
        // Disallow updating ffmpeg/ffprobe executable paths if we are not running
        // in admin mode.
        let newSettings = req.body;
        if (!serverOptions().admin) {
          newSettings = merge(
            {},
            req.serverCtx.settings.ffmpegSettings(),
            omit(newSettings, [
              'ffmpegExecutablePath',
              'ffprobeExecutablePath',
            ]),
          );
        } else {
          req.body.ffmpegExecutablePath = sanitizeForExec(
            req.body.ffmpegExecutablePath,
          );
          req.body.ffprobeExecutablePath = sanitizeForExec(
            req.body.ffprobeExecutablePath,
          );
        }

        await req.serverCtx.settings.updateSettings('ffmpeg', newSettings);
        const ffmpeg = req.serverCtx.settings.ffmpegSettings();
        req.serverCtx.eventService.push({
          type: 'settings-update',
          message: 'FFMPEG configuration updated.',
          module: 'ffmpeg',
          detail: {
            action: 'update',
          },
          level: 'info',
        });
        return res.send(ffmpeg);
      } catch (err) {
        logger.error(err);
        await res.status(500).send('error');
        req.serverCtx.eventService.push({
          type: 'settings-update',
          message: 'Error updating FFMPEG configuration.',
          module: 'ffmpeg',
          detail: {
            action: 'update',
            error: isError(err) ? firstDefined(err, 'message') : 'unknown',
          },
          level: 'error',
        });
      }
    },
  );

  fastify.post<{ Body: { ffmpegPath: string } }>(
    '/ffmpeg-settings',
    async (req, res) => {
      // RESET
      try {
        let ffmpeg = { ...defaultFfmpegSettings };
        ffmpeg.ffmpegExecutablePath = req.body.ffmpegPath;
        await req.serverCtx.settings.updateFfmpegSettings(ffmpeg);
        ffmpeg = req.serverCtx.settings.ffmpegSettings();
        req.serverCtx.eventService.push({
          type: 'settings-update',
          message: 'FFMPEG configuration reset.',
          module: 'ffmpeg',
          detail: {
            action: 'reset',
          },
          level: 'warning',
        });
        return res.send(ffmpeg);
      } catch (err) {
        logger.error(err);
        await res.status(500).send('error');
        req.serverCtx.eventService.push({
          type: 'settings-update',
          message: 'Error reseting FFMPEG configuration.',
          module: 'ffmpeg',
          detail: {
            action: 'reset',
            error: isError(err) ? firstDefined(err, 'message') : 'unknown',
          },
          level: 'error',
        });
      }
    },
  );

  done();
};
