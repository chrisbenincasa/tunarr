import express from 'express';
import { isUndefined } from 'lodash-es';
import createLogger from '../logger.js';

const logger = createLogger(import.meta);

export const fillerRouter = express.Router();

fillerRouter.get('/api/fillers', async (req, res) => {
  try {
    let fillers = await req.ctx.fillerDB.getAllFillersInfo();
    res.send(fillers);
  } catch (err) {
    logger.error(err);
    res.status(500).send('error');
  }
});
fillerRouter.get('/api/filler/:id', async (req, res) => {
  try {
    let id = req.params.id;
    if (isUndefined(id)) {
      res.status(400).send('Missing id');
    }
    let filler = await req.ctx.fillerDB.getFiller(id);
    if (filler == null) {
      res.status(404).send('Filler not found');
    }
    res.send(filler);
  } catch (err) {
    logger.error(err);
    res.status(500).send('error');
  }
});
fillerRouter.post('/api/filler/:id', async (req, res) => {
  try {
    let id = req.params.id;
    if (isUndefined(id)) {
      res.status(400).send('Missing id');
    }
    await req.ctx.fillerDB.saveFiller(id, req.body);
    res.status(204).send({});
  } catch (err) {
    logger.error(err);
    res.status(500).send('error');
  }
});
fillerRouter.put('/api/filler', async (req, res) => {
  try {
    let uuid = await req.ctx.fillerDB.createFiller(req.body);
    res.status(201).send({ id: uuid });
  } catch (err) {
    logger.error(err);
    res.status(500).send('error');
  }
});
fillerRouter.delete('/api/filler/:id', async (req, res) => {
  try {
    let id = req.params.id;
    if (isUndefined(id)) {
      res.status(400).send('Missing id');
    }
    await req.ctx.fillerDB.deleteFiller(id);
    res.status(204).send({});
  } catch (err) {
    logger.error(err);
    res.status(500).send('error');
  }
});

fillerRouter.get('/api/filler/:id/channels', async (req, res) => {
  try {
    let id = req.params.id;
    if (isUndefined(id)) {
      res.status(400).send('Missing id');
    }
    let channels = await req.ctx.fillerDB.getFillerChannels(id);
    if (channels == null) {
      res.status(404).send('Filler not found');
    }
    res.send(channels);
  } catch (err) {
    logger.error(err);
    res.status(500).send('error');
  }
});
