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
import { scheduleBackupJobs } from '../services/scheduler';
import { RouterPluginAsyncCallback } from '../types/serverType';
import {
  getDefaultLogLevel,
  getEnvironmentLogLevel,
} from '../util/logging/LoggerFactory';

export const systemSettingsRouter: RouterPluginAsyncCallback = async (
  fastify,
  // eslint-disable-next-line @typescript-eslint/require-await
) => {
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
      let backupSettingsPotentiallyChanged = false;
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
          backupSettingsPotentiallyChanged = true;
          system.backup = req.body.backup;
        }

        return file;
      });

      const refreshedSettings = req.serverCtx.settings.systemSettings();

      if (backupSettingsPotentiallyChanged) {
        scheduleBackupJobs(refreshedSettings.backup);
      }

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
    };
  }
};
