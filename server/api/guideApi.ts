import express from 'express';
import createLogger from '../logger.js';

const logger = createLogger(import.meta);

export const guideRouter = express.Router();

guideRouter.get('/api/guide/status', async (req, res) => {
  try {
    let s = await req.ctx.guideService.getStatus();
    res.send(s);
  } catch (err) {
    logger.error(err);
    res.status(500).send('error');
  }
});

guideRouter.get('/api/guide/debug', async (req, res) => {
  try {
    let s = await req.ctx.guideService.get();
    res.send(s);
  } catch (err) {
    logger.error(err);
    res.status(500).send('error');
  }
});

guideRouter.get('/api/guide/channels/:number', async (req, res) => {
  try {
    // TODO determine if these params are numbers or strings
    let dateFrom = new Date(req.query.dateFrom as string);
    let dateTo = new Date(req.query.dateTo as string);
    let lineup = await req.ctx.guideService.getChannelLineup(
      parseInt(req.params.number),
      dateFrom,
      dateTo,
    );
    if (lineup == null) {
      logger.info(
        `GET /api/guide/channels/${req.params.number} : 404 Not Found`,
      );
      res.status(404).send('Channel not found in TV guide');
    } else {
      res.send(lineup);
    }
  } catch (err) {
    logger.error(err);
    res.status(500).send('error');
  }
});
