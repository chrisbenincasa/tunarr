import { JellyfinLoginRequest } from '@tunarr/types/api';
import {
  RouterPluginCallback,
  ZodFastifyRequest,
} from '../types/serverType.js';
import { JellyfinApiClient } from '../external/jellyfin/JellyfinApiClient.js';
import { isDefined, nullToUndefined } from '../util/index.js';
import { z } from 'zod';
import { PlexApiFactory } from '../external/plex/PlexApiFactory.js';
import { MediaSource, MediaSourceType } from '../dao/entities/MediaSource.js';
import { isNull } from 'lodash-es';
import { isQueryError } from '../external/BaseApiClient.js';
import { JellyfinLibraryItemsResponse } from '@tunarr/types/jellyfin';
import { FastifyReply } from 'fastify/types/reply.js';

const mediaSourceParams = z.object({
  mediaSourceId: z.string(),
});

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

  fastify.get(
    '/jellyfin/:mediaSourceId/user_libraries',
    {
      schema: {
        params: mediaSourceParams,
        // querystring: z.object({})
      },
    },
    (req, res) =>
      withJellyfinMediaSource(req, res, async (mediaSource) => {
        const api = PlexApiFactory().getJellyfinClient({
          ...mediaSource,
          apiKey: mediaSource.accessToken,
        });

        const response = await api.getUserViews();

        if (isQueryError(response)) {
          throw response;
        }

        return res.send(response.data);
      }),
  );

  fastify.get(
    '/jellyfin/:mediaSourceId/libraries/:libraryId/movies',
    {
      schema: {
        params: mediaSourceParams.extend({
          libraryId: z.string(),
        }),
        querystring: z.object({
          offset: z.coerce.number().nonnegative().optional(),
          limit: z.coerce.number().positive().optional(),
        }),
        response: {
          200: JellyfinLibraryItemsResponse,
        },
      },
    },
    (req, res) =>
      withJellyfinMediaSource(req, res, async (mediaSource) => {
        const api = PlexApiFactory().getJellyfinClient({
          ...mediaSource,
          apiKey: mediaSource.accessToken,
        });

        const pageParams =
          isDefined(req.query.offset) && isDefined(req.query.limit)
            ? { offset: req.query.offset, limit: req.query.limit }
            : null;
        const response = await api.getLibrary(
          null,
          req.params.libraryId,
          ['Movie'],
          [],
          pageParams,
        );

        if (isQueryError(response)) {
          throw response;
        }

        return res.send(response.data);
      }),
  );

  async function withJellyfinMediaSource<
    Req extends ZodFastifyRequest<{
      params: typeof mediaSourceParams;
    }>,
  >(
    req: Req,
    res: FastifyReply,
    cb: (m: MediaSource) => Promise<FastifyReply>,
  ) {
    const mediaSource = await req.serverCtx.mediaSourceDB.getById(
      req.params.mediaSourceId,
    );

    if (isNull(mediaSource)) {
      return res
        .status(400)
        .send(`No media source with ID ${req.params.mediaSourceId} found.`);
    }

    if (mediaSource.type !== MediaSourceType.Jellyfin) {
      return res
        .status(400)
        .send(
          `Media source with ID = ${req.params.mediaSourceId} is not a Jellyfin server.`,
        );
    }

    return cb(mediaSource);
  }

  done();
};
