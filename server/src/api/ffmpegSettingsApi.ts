import { FfmpegSettings, defaultFfmpegSettings } from '@tunarr/types';
import { FfmpegSettingsSchema } from '@tunarr/types/schemas';
import { isError, isUndefined } from 'lodash-es';
import createLogger from '../logger.js';
import { RouterPluginCallback } from '../types/serverType.js';
import { firstDefined } from '../util.js';
import { z } from 'zod';

const logger = createLogger(import.meta);

export const ffmpegSettingsRouter: RouterPluginCallback = (
  fastify,
  _opts,
  done,
) => {
  fastify.get('/api/ffmpeg-settings', (req, res) => {
    try {
      const ffmpeg = req.serverCtx.settings.ffmpegSettings();
      return res.send(ffmpeg);
    } catch (err) {
      logger.error(err);
      return res.status(500).send('error');
    }
  });

  fastify.put(
    '/api/ffmpeg-settings',
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
        await req.serverCtx.settings.updateSettings('ffmpeg', req.body);
        const ffmpeg = req.serverCtx.settings.ffmpegSettings();
        const err = fixupFFMPEGSettings(ffmpeg);
        if (typeof err !== 'undefined') {
          return res.status(400).send(err);
        }
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
    '/api/ffmpeg-settings',
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

function fixupFFMPEGSettings(ffmpeg: FfmpegSettings): string | undefined {
  if (isUndefined(ffmpeg.maxFPS)) {
    ffmpeg.maxFPS = 60;
  } else if (isNaN(ffmpeg.maxFPS)) {
    return 'maxFPS should be a number';
  }
  return void 0;
}
