import express from 'express';
import createLogger from '../logger.js';
import { isUndefined } from 'lodash-es';

const logger = createLogger(import.meta);

export const customShowRouter = express.Router();

customShowRouter.get('/api/shows', async (req, res) => {
  try {
    let fillers = await req.ctx.customShowDB.getAllShowsInfo();
    res.send(fillers);
  } catch (err) {
    logger.error(err);
    res.status(500).send('error');
  }
});

customShowRouter.get('/api/show/:id', async (req, res) => {
  try {
    let id = req.params.id;
    if (isUndefined(id)) {
      res.status(400).send('Missing id');
    }
    let filler = await req.ctx.customShowDB.getShow(id);
    if (filler == null) {
      res.status(404).send('Custom show not found');
    }
    res.send(filler);
  } catch (err) {
    logger.error(err);
    res.status(500).send('error');
  }
});

customShowRouter.post('/api/show/:id', async (req, res) => {
  try {
    let id = req.params.id;
    if (isUndefined(id)) {
      res.status(400).send('Missing id');
    }
    await req.ctx.customShowDB.saveShow(id, req.body);
    res.status(204).send({});
  } catch (err) {
    logger.error(err);
    res.status(500).send('error');
  }
});

customShowRouter.put('/api/show', async (req, res) => {
  try {
    let uuid = await req.ctx.customShowDB.createShow(req.body);
    res.status(201).send({ id: uuid });
  } catch (err) {
    logger.error(err);
    res.status(500).send('error');
  }
});

customShowRouter.delete('/api/show/:id', async (req, res) => {
  try {
    let id = req.params.id;
    if (isUndefined(id)) {
      res.status(400).send('Missing id');
    }
    await req.ctx.customShowDB.deleteShow(id);
    res.status(204).send({});
  } catch (err) {
    logger.error(err);
    res.status(500).send('error');
  }
});
