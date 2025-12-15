import type { SessionType } from '@/stream/Session.js';
import type { SessionKey } from '@/stream/SessionManager.js';
import type { RouterPluginAsyncCallback } from '@/types/serverType.js';
import { run } from '@/util/index.js';
import { ChannelSessionsResponseSchema } from '@tunarr/types/api';
import { isEmpty, isNil, isNumber, map } from 'lodash-es';
import z from 'zod/v4';

// eslint-disable-next-line @typescript-eslint/require-await
export const sessionApiRouter: RouterPluginAsyncCallback = async (fastify) => {
  /**
   * List all active sessions by channel ID
   */
  fastify.get(
    '/sessions',
    {
      schema: {
        tags: ['Sessions'],
        response: {
          200: z.record(z.string(), z.array(ChannelSessionsResponseSchema)),
        },
      },
    },
    async (req, res) => {
      const sessions: Record<
        string,
        z.infer<typeof ChannelSessionsResponseSchema>[]
      > = {};
      const allSessions = req.serverCtx.sessionManager.allSessions();
      for (const sessionKey of Object.keys(allSessions)) {
        const session = allSessions[sessionKey as SessionKey];
        const [id, type] = sessionKey.split(/_(.+)?/, 2);
        sessions[id!] ??= [];
        sessions[id!]!.push({
          type: type as SessionType,
          numConnections: session?.numConnections() ?? 0,
          state: session?.state ?? 'unknown',
          connections: map(session?.connections(), (connection, token) => ({
            ...connection,
            lastHeartbeat: session?.lastHeartbeat(token),
          })),
        });
      }

      return res.send(sessions);
    },
  );

  /**
   * Returns a list of active sessions for the given channel ID (or channel number)
   */
  fastify.get(
    '/channels/:id/sessions',
    {
      schema: {
        tags: ['Sessions'],
        params: z.object({
          id: z.coerce.number().or(z.string().uuid()),
        }),
        response: {
          200: z.array(ChannelSessionsResponseSchema),
          404: z.string(),
        },
      },
    },
    async (req, res) => {
      const channelId = await run(async () => {
        if (isNumber(req.params.id)) {
          return (await req.serverCtx.channelDB.getChannel(req.params.id))
            ?.uuid;
        } else {
          return req.params.id;
        }
      });

      if (isNil(channelId)) {
        return res.status(404).send('Could not derive channel ID');
      }

      const sessions =
        req.serverCtx.sessionManager.getAllConcatSessions(channelId);

      if (isEmpty(sessions)) {
        return res.status(404).send('No session found for channel ID');
      }

      return res.send(
        map(sessions, (session) => ({
          type: session.sessionType,
          numConnections: session?.numConnections() ?? 0,
          state: session?.state ?? 'unknown',
          connections: map(session?.connections(), (connection, token) => ({
            ...connection,
            lastHeartbeat: session?.lastHeartbeat(token),
          })),
        })),
      );
    },
  );

  /**
   * Stop all transcode sessions for a channel
   */
  fastify.delete(
    '/channels/:id/sessions',
    {
      schema: {
        tags: ['Sessions'],
        params: z.object({
          id: z.coerce.number().or(z.string().uuid()),
        }),
        response: {
          200: ChannelSessionsResponseSchema,
          201: z.void(),
          404: z.string(),
        },
      },
    },
    async (req, res) => {
      const channelId = await run(async () => {
        if (isNumber(req.params.id)) {
          return (await req.serverCtx.channelDB.getChannel(req.params.id))
            ?.uuid;
        } else {
          return req.params.id;
        }
      });

      if (isNil(channelId)) {
        return res.status(404).send('Could not derive channel ID');
      }

      const sessions =
        req.serverCtx.sessionManager.getAllSessionsForChannel(channelId);

      if (isEmpty(sessions)) {
        return res.status(404).send('No session found for channel ID');
      }

      for (const session of sessions) {
        await req.serverCtx.sessionManager.endSession(session);
      }

      return res.status(201).send();
    },
  );
};
