import { TrannscodeConfig as TrannscodeConfigDao } from '@/db/schema/TranscodeConfig.ts';
import { serverOptions } from '@/globals.js';
import { RouterPluginCallback } from '@/types/serverType.js';
import { firstDefined } from '@/util/index.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import { numberToBoolean } from '@/util/sqliteUtil.ts';
import { sanitizeForExec } from '@/util/strings.js';
import { TranscodeConfig, defaultFfmpegSettings } from '@tunarr/types';
import { IdPathParamSchema } from '@tunarr/types/api';
import {
  FfmpegSettingsSchema,
  TranscodeConfigSchema,
} from '@tunarr/types/schemas';
import { isError, map, merge, omit } from 'lodash-es';
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

  fastify.get(
    '/transcode_configs',
    {
      schema: {
        response: {
          200: z.array(TranscodeConfigSchema),
        },
      },
    },
    async (req, res) => {
      const configs = await req.serverCtx.transcodeConfigDB.getAll();
      const apiConfigs = map(configs, dbTranscodeConfigToApiSchema);
      return res.send(apiConfigs);
    },
  );

  fastify.get(
    '/transcode_configs/:id',
    {
      schema: {
        params: z.object({
          id: z.string().uuid(),
        }),
        response: {
          200: TranscodeConfigSchema,
          404: z.void(),
        },
      },
    },
    async (req, res) => {
      const config = await req.serverCtx.transcodeConfigDB.getById(
        req.params.id,
      );
      if (!config) {
        return res.status(404).send();
      }

      return res.send(dbTranscodeConfigToApiSchema(config));
    },
  );

  fastify.post(
    '/transcode_configs',
    {
      schema: {
        body: TranscodeConfigSchema.omit({
          id: true,
        }),
        response: {
          201: TranscodeConfigSchema,
        },
      },
    },
    async (req, res) => {
      const newConfig = await req.serverCtx.transcodeConfigDB.insertConfig(
        req.body,
      );
      return res.status(201).send(dbTranscodeConfigToApiSchema(newConfig));
    },
  );

  fastify.put(
    '/transcode_configs/:id',
    {
      schema: {
        body: TranscodeConfigSchema,
        params: IdPathParamSchema,
        response: {
          200: TranscodeConfigSchema,
        },
      },
    },
    async (req, res) => {
      await req.serverCtx.transcodeConfigDB.updateConfig(
        req.params.id,
        req.body,
      );
      return res.send(req.body);
    },
  );

  fastify.delete(
    '/transcode_configs/:id',
    {
      schema: {
        params: IdPathParamSchema,
        response: {
          200: z.void(),
        },
      },
    },
    async (req, res) => {
      const config = await req.serverCtx.transcodeConfigDB.getById(
        req.params.id,
      );
      if (!config) {
        return res.status(404).send();
      }
      await req.serverCtx.transcodeConfigDB.deleteConfig(req.params.id);
      return res.send();
    },
  );

  done();
};

function dbTranscodeConfigToApiSchema(
  config: TrannscodeConfigDao,
): TranscodeConfig {
  return {
    ...config,
    id: config.uuid,
    disableChannelOverlay: numberToBoolean(config.disableChannelOverlay),
    normalizeFrameRate: numberToBoolean(config.normalizeFrameRate),
    deinterlaceVideo: numberToBoolean(config.deinterlaceVideo),
    isDefault: numberToBoolean(config.isDefault),
  } satisfies TranscodeConfig;
}
