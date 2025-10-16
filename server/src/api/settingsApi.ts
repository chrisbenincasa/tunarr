import { GlobalMediaSourceSettingsSchema } from '@tunarr/types/schemas';
import type { RouterPluginAsyncCallback } from '../types/serverType.js';

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
      return res.send(settings);
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
        },
      },
    },
    async (req, res) => {
      await req.serverCtx.settings.updateSettings('mediaSource', req.body);
      return res.send(req.serverCtx.settings.globalMediaSourceSettings());
    },
  );
};
