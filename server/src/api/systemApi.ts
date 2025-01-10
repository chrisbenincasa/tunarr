import { serverOptions } from '@/globals.js';
import { scheduleBackupJobs } from '@/services/Scheduler.js';
import { RouterPluginAsyncCallback } from '@/types/serverType.js';
import { getDefaultLogLevel } from '@/util/defaults.js';
import { ifDefined } from '@/util/index.js';
import { getEnvironmentLogLevel } from '@/util/logging/LoggerFactory.js';
import { LoggingSettings, SystemSettings } from '@tunarr/types';
import {
  SystemSettingsResponse,
  SystemSettingsResponseSchema,
  UpdateBackupSettingsRequestSchema,
  UpdateSystemSettingsRequestSchema,
} from '@tunarr/types/api';
import { BackupSettings, BackupSettingsSchema } from '@tunarr/types/schemas';
import { isUndefined } from 'lodash-es';
import { DeepReadonly, Writable } from 'ts-essentials';
import { z } from 'zod';

export const systemApiRouter: RouterPluginAsyncCallback = async (
  fastify,
  // eslint-disable-next-line @typescript-eslint/require-await
) => {
  fastify.get('/system/health', async (req, res) => {
    const results = await req.serverCtx.healthCheckService.runAll();
    return res.send(results);
  });

  fastify.get(
    '/system/settings',
    {
      schema: {
        response: {
          200: SystemSettingsResponseSchema,
        },
      },
    },
    async (req, res) => {
      const settings = req.serverCtx.settings.systemSettings();
      return res.send(getSystemSettingsResponse(settings));
    },
  );

  fastify.get('/system/state', async (req, res) => {
    return res.send(req.serverCtx.settings.migrationState);
  });

  fastify.post(
    '/system/fixers/:fixerId/run',
    {
      schema: {
        params: z.object({
          fixerId: z.string(),
        }),
      },
    },
    async (req, res) => {
      const fixer = req.serverCtx.fixerRunner.getFixerByName(
        req.params.fixerId,
      );
      if (!fixer) {
        return res
          .status(400)
          .send(`Unknown fixer ${req.params.fixerId} specified`);
      }

      // Someday!
      // await runWorker(
      //   new URL('../tasks/fixers/backfillProgramGroupings', import.meta.url),
      // );

      await fixer.run();

      return res.send();
    },
  );

  fastify.put(
    '/system/settings',
    {
      schema: {
        body: UpdateSystemSettingsRequestSchema,
        response: {
          200: SystemSettingsResponseSchema,
        },
      },
    },
    async (req, res) => {
      await req.serverCtx.settings.directUpdate((file) => {
        const { system } = file;
        system.logging.useEnvVarLevel =
          req.body.logging?.useEnvVarLevel ?? true;
        if (system.logging.useEnvVarLevel) {
          system.logging.logLevel = getDefaultLogLevel(false);
        } else {
          system.logging.logLevel =
            req.body.logging?.logLevel ?? getDefaultLogLevel(false);
        }

        if (!isUndefined(req.body.backup)) {
          system.backup = req.body.backup;
          scheduleBackupJobs(req.body.backup);
        }

        ifDefined(req.body.cache, (cache) => {
          system.cache = cache;
        });

        return file;
      });

      const refreshedSettings = req.serverCtx.settings.systemSettings();

      return res.send(getSystemSettingsResponse(refreshedSettings));
    },
  );

  fastify.put(
    '/system/settings/backup',
    {
      schema: {
        body: UpdateBackupSettingsRequestSchema,
        response: {
          200: BackupSettingsSchema,
        },
      },
    },
    async (req, res) => {
      await req.serverCtx.settings.directUpdate((settings) => {
        settings.system.backup = req.body;
        return settings;
      });

      return res.send(
        req.serverCtx.settings.backup as Writable<BackupSettings>,
      );
    },
  );

  function getSystemSettingsResponse(
    settings: DeepReadonly<SystemSettings>,
  ): SystemSettingsResponse {
    const envLogLevel = getEnvironmentLogLevel();
    return {
      ...(settings as Writable<SystemSettings>),
      logging: {
        ...(settings.logging as Writable<LoggingSettings>),
        environmentLogLevel: envLogLevel,
      },
      adminMode: serverOptions().admin,
    };
  }
};
