import { ChannelLineup } from '@tunarr/types';
import { ChannelLineupSchema } from '@tunarr/types/schemas';
import { map } from 'lodash-es';
import { z } from 'zod';
import createLogger from '../logger.js';
import { RouterPluginCallback } from '../types/serverType.js';

const logger = createLogger(import.meta);

export const guideRouter: RouterPluginCallback = (fastify, _opts, done) => {
  fastify.get('/api/guide/status', async (req, res) => {
    try {
      const s = await req.serverCtx.guideService.getStatus();
      return res.send(s);
    } catch (err) {
      logger.error(req.routeOptions.url, err);
      return res.status(500).send('error');
    }
  });

  fastify.get('/api/guide/debug', async (req, res) => {
    try {
      const s = await req.serverCtx.guideService.get();
      return res.send(s);
    } catch (err) {
      logger.error(req.routeOptions.url, err);
      return res.status(500).send('error');
    }
  });

  fastify.get(
    '/api/guide/channels',
    {
      schema: {
        querystring: z.object({
          dateFrom: z.coerce.date(),
          dateTo: z.coerce.date(),
        }),
        response: {
          200: z.record(ChannelLineupSchema),
        },
      },
    },
    async (req, res) => {
      const allChannelIds = map(
        await req.serverCtx.channelDB.getAllChannels(),
        'uuid',
      );

      const allLineups = await allChannelIds.reduce(
        async (prev, curr) => {
          const res = await req.serverCtx.guideService.getChannelLineup(
            curr,
            req.query.dateFrom,
            req.query.dateTo,
          );
          if (res) {
            return { ...(await prev), [curr]: res };
          } else {
            return prev;
          }
        },
        Promise.resolve({} as Record<string, ChannelLineup>),
      );

      return res.send(allLineups);
    },
  );

  fastify.get<{
    Params: { id: string };
    Querystring: { dateFrom: string; dateTo: string };
  }>('/api/guide/channels/:number', async (req, res) => {
    try {
      // TODO determine if these params are numbers or strings
      const dateFrom = new Date(req.query.dateFrom);
      const dateTo = new Date(req.query.dateTo);
      const lineup = await req.serverCtx.guideService.getChannelLineup(
        req.params.id,
        dateFrom,
        dateTo,
      );
      if (lineup == null) {
        logger.info(`GET /api/guide/channels/${req.params.id} : 404 Not Found`);
        return res.status(404).send('Channel not found in TV guide');
      } else {
        return res.send(lineup);
      }
    } catch (err) {
      logger.error(req.routeOptions.url, err);
      return res.status(500).send('error');
    }
  });

  done();
};
