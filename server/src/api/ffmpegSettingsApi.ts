import type { RouterPluginCallback } from '@/types/serverType.js';
import { makeWritable } from '@/util/index.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import { sanitizeForExec } from '@/util/strings.js';
import { defaultFfmpegSettings } from '@tunarr/types';
import { IdPathParamSchema } from '@tunarr/types/api';
import {
  FfmpegSettingsSchema,
  TranscodeConfigSchema,
} from '@tunarr/types/schemas';
import { isError, map } from 'lodash-es';
import { match, P } from 'ts-pattern';
import { z } from 'zod/v4';
import { dbTranscodeConfigToApiSchema } from '../db/converters/transcodeConfigConverters.ts';
import { GlobalScheduler } from '../services/Scheduler.ts';
import { SubtitleExtractorTask } from '../tasks/SubtitleExtractorTask.ts';
import { TranscodeConfigNotFoundError } from '../types/errors.ts';

export const ffmpegSettingsRouter: RouterPluginCallback = (
  fastify,
  _opts,
  done,
) => {
  const logger = LoggerFactory.child({
    caller: import.meta,
    className: 'FfmpegSettingsApi',
  });

  fastify.get(
    '/ffmpeg-settings',
    {
      schema: {
        tags: ['Settings'],
        response: {
          200: FfmpegSettingsSchema,
          500: z.literal('error'),
        },
      },
    },
    async (req, res) => {
      try {
        const ffmpeg = req.serverCtx.settings.ffmpegSettings();
        return res.send(makeWritable(ffmpeg));
      } catch (err) {
        logger.error(err);
        return res.status(500).send('error');
      }
    },
  );

  fastify.put(
    '/ffmpeg-settings',
    {
      schema: {
        tags: ['Settings'],
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
        const currentSettings = req.serverCtx.settings.ffmpegSettings();
        const newSettings = req.body;
        newSettings.ffmpegExecutablePath = sanitizeForExec(
          newSettings.ffmpegExecutablePath,
        );
        newSettings.ffprobeExecutablePath = sanitizeForExec(
          newSettings.ffprobeExecutablePath,
        );

        await req.serverCtx.settings.updateSettings('ffmpeg', newSettings);
        const ffmpeg = req.serverCtx.settings.ffmpegSettings();

        if (
          !currentSettings.enableSubtitleExtraction &&
          req.body.enableSubtitleExtraction
        ) {
          GlobalScheduler.runScheduledJobNow(
            SubtitleExtractorTask.ID,
            true,
          ).catch((e) => {
            logger.error(
              e,
              'Error running SubtitleExtractorTask after settings change',
            );
          });
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
        return res.send(makeWritable(ffmpeg));
      } catch (err) {
        logger.error(err);
        await res.status(500).send('error');
        req.serverCtx.eventService.push({
          type: 'settings-update',
          message: 'Error updating FFMPEG configuration.',
          module: 'ffmpeg',
          detail: {
            action: 'update',
            error: isError(err) ? err.message : 'unknown',
          },
          level: 'error',
        });
      }
    },
  );

  fastify.post(
    '/ffmpeg-settings',
    {
      schema: {
        tags: ['Settings'],
        body: z.object({
          ffmpegPath: z.string(),
        }),
        repsonse: {
          200: FfmpegSettingsSchema,
          500: z.literal('error'),
        },
      },
    },
    async (req, res) => {
      // RESET
      try {
        const ffmpeg = { ...defaultFfmpegSettings };
        ffmpeg.ffmpegExecutablePath = req.body.ffmpegPath;
        await req.serverCtx.settings.updateFfmpegSettings(ffmpeg);
        req.serverCtx.eventService.push({
          type: 'settings-update',
          message: 'FFMPEG configuration reset.',
          module: 'ffmpeg',
          detail: {
            action: 'reset',
          },
          level: 'warning',
        });
        return res.send(req.serverCtx.settings.ffmpegSettings());
      } catch (err) {
        logger.error(err);
        await res.status(500).send('error');
        req.serverCtx.eventService.push({
          type: 'settings-update',
          message: 'Error reseting FFMPEG configuration.',
          module: 'ffmpeg',
          detail: {
            action: 'reset',
            error: isError(err) ? err.message : 'unknown',
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
        tags: ['Settings'],
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
        tags: ['Settings'],
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
    '/transcode_configs/:id/copy',
    {
      schema: {
        params: z.object({
          id: z.uuid(),
        }),
        response: {
          200: TranscodeConfigSchema,
          404: z.void(),
          500: z.void(),
        },
      },
    },
    async (req, res) => {
      const copyResult = await req.serverCtx.transcodeConfigDB.duplicateConfig(
        req.params.id,
      );

      if (copyResult.isFailure()) {
        logger.error(copyResult.error);
        return match(copyResult.error)
          .with(P.instanceOf(TranscodeConfigNotFoundError), () =>
            res.status(404).send(),
          )
          .with(P._, () => res.status(500).send())
          .exhaustive();
      }

      return res.send(dbTranscodeConfigToApiSchema(copyResult.get()));
    },
  );

  fastify.post(
    '/transcode_configs',
    {
      schema: {
        tags: ['Settings'],
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
        tags: ['Settings'],
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
        tags: ['Settings'],
        params: IdPathParamSchema,
        response: {
          200: z.void(),
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
      await req.serverCtx.transcodeConfigDB.deleteConfig(req.params.id);
      return res.send();
    },
  );

  done();
};
