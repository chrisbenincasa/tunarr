import { FastifyPluginCallback } from 'fastify';
import createLogger from '../logger.js';

const logger = createLogger(import.meta);

export const guideRouter: FastifyPluginCallback = (fastify, _opts, done) => {
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
      logger.error(err);
      return res.status(500).send('error');
    }
  });

  fastify.get<{
    Params: { number: number };
    Querystring: { dateFrom: string; dateTo: string };
  }>('/api/guide/channels/:number', async (req, res) => {
    try {
      // TODO determine if these params are numbers or strings
      const dateFrom = new Date(req.query.dateFrom);
      const dateTo = new Date(req.query.dateTo);
      const lineup = await req.serverCtx.guideService.getChannelLineup(
        req.params.number,
        dateFrom,
        dateTo,
      );
      if (lineup == null) {
        logger.info(
          `GET /api/guide/channels/${req.params.number} : 404 Not Found`,
        );
        return res.status(404).send('Channel not found in TV guide');
      } else {
        return res.send(lineup);
      }
    } catch (err) {
      logger.error(err);
      return res.status(500).send('error');
    }
  });

  done();
};
