import {
  SystemSettingsResponseSchema,
  UpdateSystemSettingsRequestSchema,
} from '@tunarr/types/api';
import { RouterPluginAsyncCallback } from '../types/serverType';
import {
  getDefaultLogLevel,
  getEnvironmentLogLevel,
} from '../util/logging/LoggerFactory';
import { SystemSettings } from '@tunarr/types';

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
      await req.serverCtx.settings.directUpdate((file) => {
        const { system } = file;
        system.logging.useEnvVarLevel = req.body.useEnvVarLevel ?? true;
        if (system.logging.useEnvVarLevel) {
          system.logging.logLevel = getDefaultLogLevel(false);
        } else {
          system.logging.logLevel =
            req.body.logLevel ?? getDefaultLogLevel(false);
        }
        return file;
      });

      return res.send(
        getSystemSettingsResponse(req.serverCtx.settings.systemSettings()),
      );
    },
  );

  function getSystemSettingsResponse(settings: SystemSettings) {
    const envLogLevel = getEnvironmentLogLevel();
    return {
      ...settings,
      logging: {
        ...settings.logging,
        environmentLogLevel: envLogLevel,
      },
    };
  }
};
