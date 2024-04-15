import fastifyStatic from '@fastify/static';
import { RouterPluginAsyncCallback } from '../types/serverType.js';
import fs from 'node:fs/promises';
import { join } from 'node:path';
import { isNil, map } from 'lodash-es';
import { sessionManager } from '../stream/sessionManager.js';
import { z } from 'zod';
import { TruthyQueryParam } from '../types/schemas.js';
import { v4 } from 'uuid';

// eslint-disable-next-line @typescript-eslint/require-await
export const hlsApi: RouterPluginAsyncCallback = async (fastify) => {
  fastify
    .register(fastifyStatic, {
      root: join(process.cwd(), 'streams'),
      decorateReply: false,
      prefix: '/streams/',
    })
    .decorateRequest('streamChannel', null)
    .addHook('onRequest', (req, res, done) => {
      const matches = req.url.match(/^\/streams\/stream_(.*)\/stream\.m3u8.*/);
      if (!isNil(matches) && matches.length > 1) {
        const query = req.query as Record<string, string>;
        const channelId = matches[1];
        req.streamChannel = channelId;
        const token = query['token'];
        const session = sessionManager.getSession(channelId);
        if (isNil(session)) {
          void res.status(404).send();
          return;
        }

        if (isNil(token)) {
          void res.status(400).send('Requires a token');
          return;
        }

        if (!session.isKnownConnection(token)) {
          void res.status(404).send('Unrecognized session token: ' + token);
        }

        // req.ip
        session.recordHeartbeat(req.ip);
        if (!isNil(token)) {
          session.recordHeartbeat(token);
        }
      }
      done();
    })
    .addHook('onResponse', (req, res, done) => {
      const token = (req.query as Record<string, string>)['token'];
      if (
        res.statusCode === 200 &&
        !isNil(token) &&
        !isNil(req.streamChannel)
      ) {
        const session = sessionManager.getSession(req.streamChannel);
        session?.recordHeartbeat(req.ip);
        if (!isNil(session) && session.isKnownConnection(token)) {
          session.recordHeartbeat(token);
        }
        // Keep track of active clients.
        // Parse out the channel ID from the request path
        // If we get an ID, reset the counter
        // console.log(req.url);
      }
      done();
    })
    .put('/streams/*', async (_, res) => {
      await res.send(200);
    });

  fastify.get(
    '/media-player/:id/hls/now',
    {
      schema: {
        params: z.object({
          id: z.string().uuid(),
        }),
        querystring: z.object({
          direct: TruthyQueryParam.optional().default('0'),
          token: z.string().uuid().optional(),
        }),
      },
    },
    async (req, res) => {
      // const channel = await req.serverCtx.channelCache.getChannelConfig(
      //   req.params.number,
      // );

      // if (isNil(channel)) {
      //   return res.status(404).send("Channel doesn't exist");
      // }

      // How should we handle this...
      // const token = req.query.token ?? v4();

      const session = await sessionManager.getOrCreateSession(
        req.params.id,
        req.serverCtx.settings.ffmpegSettings(),
        req.ip,
        {
          ip: req.ip,
        },
      );

      if (isNil(session)) {
        return res.status(500).send('Error starting session');
      }

      return res.type('text').send(await fs.readFile(session.streamPath));
    },
  );

  fastify.get(
    '/media-player/:channelId/hls',
    {
      schema: {
        params: z.object({
          channelId: z.coerce.number().or(z.string().uuid()),
        }),
        querystring: z.object({
          direct: TruthyQueryParam.optional().default('0'),
        }),
      },
    },
    async (req, res) => {
      const channel = await req.serverCtx.channelDB.getChannel(
        req.params.channelId,
      );

      if (isNil(channel)) {
        return res.status(404).send("Channel doesn't exist");
      }

      const token = v4();

      const session = await sessionManager.getOrCreateSession(
        channel.uuid,
        req.serverCtx.settings.ffmpegSettings(),
        token,
        {
          ip: req.ip,
        },
      );

      if (isNil(session)) {
        return res.status(500).send('Error starting session');
      }

      if (req.query.direct) {
        console.log(session.serverPath);
        return res.redirect(302, `${session.serverPath}?token=${token}`);
      }

      return res.send({
        streamPath: `${session.serverPath}?token=${token}`,
      });
    },
  );

  fastify.get(
    '/media-player/:number/session',
    {
      schema: {
        params: z.object({
          number: z.coerce.number(),
        }),
      },
    },
    async (req, res) => {
      const channel = await req.serverCtx.channelDB.getChannel(
        req.params.number,
      );
      if (isNil(channel)) {
        return res.status(404).send("Channel doesn't exist");
      }

      const session = sessionManager.getSession(channel.uuid);

      return res.send({
        channelId: channel.uuid,
        channelNumber: channel.number,
        numConnections: session?.numConnections() ?? 0,
        connections: map(session?.connections(), (connection, token) => ({
          ...connection,
          lastHeartbeat: session?.lastHeartbeat(token),
        })),
      });
    },
  );

  fastify.delete(
    '/media-player/:channelId/session',
    {
      schema: {
        params: z.object({
          channelId: z.coerce.number().or(z.string().uuid()),
        }),
      },
    },
    async (req, res) => {
      const channel = await req.serverCtx.channelDB.getChannel(
        req.params.channelId,
      );
      if (isNil(channel)) {
        return res.status(404).send("Channel doesn't exist");
      }

      const session = sessionManager.getSession(channel.uuid);

      if (isNil(session)) {
        return res.status(404).send('No sessions for channel');
      }

      session.stop();

      return res.send();
    },
  );
};
