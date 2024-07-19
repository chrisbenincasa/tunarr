import { JellyfinLoginRequest } from '@tunarr/types/api';
import { RouterPluginCallback } from '../types/serverType.js';
import { JellyfinApiClient } from '../external/jellyfin/JellyfinApiClient.js';
import { nullToUndefined } from '../util/index.js';

export const jellyfinApiRouter: RouterPluginCallback = (fastify, _, done) => {
  fastify.post(
    '/jellyfin/login',
    {
      schema: {
        body: JellyfinLoginRequest,
      },
    },
    async (req, res) => {
      const response = await JellyfinApiClient.login(
        { uri: req.body.url, type: 'jellyfin', name: 'Unknown' },
        req.body.username,
        req.body.password,
      );

      return res.send({ accessToken: nullToUndefined(response.AccessToken) });
    },
  );

  done();
};
