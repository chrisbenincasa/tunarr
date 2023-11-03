import { FastifyPluginCallback } from 'fastify';
import { isUndefined } from 'lodash-es';
import { CustomShowInsert, CustomShowUpdate } from '../dao/customShowDb.js';
import createLogger from '../logger.js';

const logger = createLogger(import.meta);

type CustomShowIdParams = {
  Params: { id: string };
};

export const customShowRouter: FastifyPluginCallback = (
  fastify,
  _opts,
  done,
) => {
  fastify.get('/api/shows', (req, res) => {
    try {
      const fillers = req.serverCtx.customShowDB.getAllShowsInfo();
      return res.send(fillers);
    } catch (err) {
      logger.error(err);
      return res.status(500).send('error');
    }
  });

  fastify.get<CustomShowIdParams>('/api/show/:id', async (req, res) => {
    try {
      const id = req.params.id;
      if (isUndefined(id)) {
        return res.status(400).send('Missing id');
      }
      const filler = req.serverCtx.customShowDB.getShow(id);
      if (filler == null) {
        return res.status(404).send('Custom show not found');
      }
      return res.send(filler);
    } catch (err) {
      logger.error(err);
      return res.status(500).send('error');
    }
  });

  fastify.post<CustomShowIdParams & { Body: CustomShowUpdate }>(
    '/api/show/:id',
    async (req, res) => {
      try {
        const id = req.params.id;
        if (isUndefined(id)) {
          return res.status(400).send('Missing id');
        }
        await req.serverCtx.customShowDB.saveShow(id, req.body);
        return res.status(204).send({});
      } catch (err) {
        logger.error(err);
        return res.status(500).send('error');
      }
    },
  );

  fastify.put<{ Body: CustomShowInsert }>('/api/show', async (req, res) => {
    try {
      const uuid = await req.serverCtx.customShowDB.createShow(req.body);
      return res.status(201).send({ id: uuid });
    } catch (err) {
      logger.error(err);
      return res.status(500).send('error');
    }
  });

  fastify.delete<CustomShowIdParams>('/api/show/:id', async (req, res) => {
    try {
      const id = req.params.id;
      if (isUndefined(id)) {
        return res.status(400).send('Missing id');
      }
      await req.serverCtx.customShowDB.deleteShow(id);
      return res.status(204).send({});
    } catch (err) {
      logger.error(err);
      return res.status(500).send('error');
    }
  });

  done();
};
