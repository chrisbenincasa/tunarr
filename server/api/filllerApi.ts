import { FastifyPluginCallback } from 'fastify';
import { isUndefined } from 'lodash-es';
import { FillerCreate, FillerUpdate } from '../dao/fillerDb.js';
import createLogger from '../logger.js';

const logger = createLogger(import.meta);

export const fillerRouter: FastifyPluginCallback = (fastify, _opts, done) => {
  fastify.get('/api/fillers', async (req, res) => {
    try {
      const fillers = req.serverCtx.fillerDB.getAllFillersInfo();
      return res.send(fillers);
    } catch (err) {
      logger.error(req.routeConfig.url, err);
      return res.status(500).send('error');
    }
  });

  fastify.get<{ Params: { id: string } }>(
    '/api/filler/:id',
    async (req, res) => {
      try {
        const id = req.params.id;
        if (isUndefined(id)) {
          return res.status(400).send('Missing id');
        }
        const filler = req.serverCtx.fillerDB.getFiller(id);
        if (filler == null) {
          return res.status(404).send('Filler not found');
        }
        return res.send(filler);
      } catch (err) {
        logger.error(req.routeConfig.url, err);
        return res.status(500).send('error');
      }
    },
  );

  fastify.post<{ Params: { id: string }; Body: FillerUpdate }>(
    '/api/filler/:id',
    async (req, res) => {
      try {
        const id = req.params.id;
        if (isUndefined(id)) {
          return res.status(400).send('Missing id');
        }
        await req.serverCtx.fillerDB.saveFiller(id, req.body);
        return res.status(204).send({});
      } catch (err) {
        logger.error(req.routeConfig.url, err);
        return res.status(500).send('error');
      }
    },
  );

  fastify.put<{ Body: FillerCreate }>('/api/filler', async (req, res) => {
    try {
      const uuid = await req.serverCtx.fillerDB.createFiller(req.body);
      return res.status(201).send({ id: uuid });
    } catch (err) {
      logger.error(req.routeConfig.url, err);
      return res.status(500).send('error');
    }
  });

  fastify.delete<{ Params: { id: string } }>(
    '/api/filler/:id',
    async (req, res) => {
      try {
        const id = req.params.id;
        if (isUndefined(id)) {
          return res.status(400).send('Missing id');
        }
        await req.serverCtx.fillerDB.deleteFiller(id);
        return res.status(204).send({});
      } catch (err) {
        logger.error(req.routeConfig.url, err);
        return res.status(500).send('error');
      }
    },
  );

  fastify.get<{ Params: { id: string } }>(
    '/api/filler/:id/channels',
    async (req, res) => {
      try {
        const id = req.params.id;
        if (isUndefined(id)) {
          return res.status(400).send('Missing id');
        }
        const channels = req.serverCtx.fillerDB.getFillerChannels(id);
        if (channels == null) {
          return res.status(404).send('Filler not found');
        }
        return res.send(channels);
      } catch (err) {
        logger.error(req.routeConfig.url, err);
        return res.status(500).send('error');
      }
    },
  );

  done();
};
