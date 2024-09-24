import { ChannelSessionsResponseSchema } from '@tunarr/types/api';
import { isEmpty, isNil, isNumber, map } from 'lodash-es';
import z from 'zod';
import { SessionType } from '../stream/Session';
import { SessionKey } from '../stream/SessionManager';
import { RouterPluginAsyncCallback } from '../types/serverType';
import { run } from '../util';

// eslint-disable-next-line @typescript-eslint/require-await
export const sessionApiRouter: RouterPluginAsyncCallback = async (fastify) => {
  /**
   * List all active sessions by channel ID
   */
  fastify.get(
    '/sessions',
    {
      schema: {
        response: {
          200: z.record(z.array(ChannelSessionsResponseSchema)),
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
        sessions[id] ??= [];
        sessions[id].push({
          type: type as SessionType,
          numConnections: session?.numConnections() ?? 0,
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
          return (
            await req.serverCtx.channelDB.getChannelByNumber(req.params.id)
          )?.uuid;
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
        params: z.object({
          id: z.coerce.number().or(z.string().uuid()),
        }),
        response: {
          200: ChannelSessionsResponseSchema,
          404: z.string(),
        },
      },
    },
    async (req, res) => {
      const channelId = await run(async () => {
        if (isNumber(req.params.id)) {
          return (
            await req.serverCtx.channelDB.getChannelByNumber(req.params.id)
          )?.uuid;
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

      for (const session of sessions) {
        await req.serverCtx.sessionManager.endSession(session);
      }

      return res.status(201).send();
    },
  );
};
