import { SystemSettingsSchema } from '@tunarr/types';
import { FastifyPluginAsync } from 'fastify';

// eslint-disable-next-line @typescript-eslint/require-await
export const systemSettingsRouter: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/system/settings',
    {
      schema: {
        response: {
          200: SystemSettingsSchema,
        },
      },
    },
    async (req, res) => {
      const settings = req.serverCtx.settings.systemSettings();
      return res.send(settings);
    },
  );
};
