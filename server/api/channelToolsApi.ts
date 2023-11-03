import JSONStream from 'JSONStream';
import express from 'express';
import createLogger from '../logger.js';
import timeSlotsService from '../services/timeSlotsService.js';
import randomSlotsService from '../services/randomSlotsService.js';
import throttle from '../services/throttle.js';

const logger = createLogger(import.meta);

export const channelToolRouter = express.Router();

channelToolRouter.post('/api/channel-tools/time-slots', async (req, res) => {
  try {
    let toolRes = await timeSlotsService(req.body.programs, req.body.schedule);
    if (typeof toolRes.userError !== 'undefined') {
      logger.error('time slots error: ' + toolRes.userError);
      res.status(400).send(toolRes.userError);
    }
    await streamToolResult(toolRes, res);
  } catch (err) {
    logger.error(err);
    res.status(500).send('Internal error');
  }
});

channelToolRouter.post('/api/channel-tools/random-slots', async (req, res) => {
  try {
    let toolRes = await randomSlotsService(
      req.body.programs,
      req.body.schedule,
    );
    if (typeof toolRes.userError !== 'undefined') {
      logger.error('random slots error: ' + toolRes.userError);
      res.status(400).send(toolRes.userError);
    }
    await streamToolResult(toolRes, res);
  } catch (err) {
    logger.error('Error', err);
    res.status(500).send('Internal error');
  }
});

async function streamToolResult(toolRes, res) {
  let programs = toolRes.programs;
  delete toolRes.programs;
  let s = JSON.stringify(toolRes);
  s = s.slice(0, -1);
  logger.info(JSON.stringify(toolRes));

  res.writeHead(200, {
    'Content-Type': 'application/json',
  });

  let transformStream = JSONStream.stringify(s + ',"programs":[', ',', ']}');
  transformStream.pipe(res);

  for (let i = 0; i < programs.length; i++) {
    transformStream.write(programs[i]);
    await throttle();
  }
  transformStream.end();
}
