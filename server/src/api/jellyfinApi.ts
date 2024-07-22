import { JellyfinLoginRequest } from '@tunarr/types/api';
import { RouterPluginCallback } from '../types/serverType.js';
import { JellyfinApiClient } from '../external/jellyfin/JellyfinApiClient.js';
import { nullToUndefined } from '../util/index.js';
import { z } from 'zod';
import { PlexApiFactory } from '../external/plex/PlexApiFactory.js';
import { MediaSourceType } from '../dao/entities/MediaSource.js';
import { isNull } from 'lodash-es';
import { isQueryError } from '../external/BaseApiClient.js';

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
        { uri: req.body.url, name: 'Unknown' },
        req.body.username,
        req.body.password,
      );

      return res.send({ accessToken: nullToUndefined(response.AccessToken) });
    },
  );

  done();

  fastify.get(
    '/jellyfin/:id/user_libraries',
    {
      schema: {
        params: z.object({
          id: z.string(),
        }),
        // querystring: z.object({})
      },
    },
    async (req, res) => {
      const mediaSource = await req.serverCtx.mediaSourceDB.getById(
        req.params.id,
      );
      if (isNull(mediaSource)) {
        return res
          .status(400)
          .send(`No media source with ID ${req.params.id} found.`);
      }

      if (mediaSource.type !== MediaSourceType.Jellyfin) {
        return res
          .status(400)
          .send(
            `Media source with ID = ${req.params.id} is not a Jellyfin server.`,
          );
      }

      const api = PlexApiFactory().getJellyfinClient({
        ...mediaSource,
        apiKey: mediaSource.accessToken,
      });

      const response = await api.getUserLibraries();

      if (isQueryError(response)) {
        throw response;
      }

      return res.send(response.data);
    },
  );
};
