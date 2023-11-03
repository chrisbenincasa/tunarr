import JSONStream from 'JSONStream';
import express from 'express';
import createLogger from '../logger.js';
import { isUndefined, omit, sortBy } from 'lodash-es';
import { Channel } from '../dao/db.js';
import { xmltvInterval } from '../xmltvGenerator.js';
import throttle from '../services/throttle.js';

const logger = createLogger(import.meta);

export const channelsRouter = express.Router();

channelsRouter.get('/api(/v1)?/channels', async (req, res) => {
  try {
    let channels = sortBy(req.ctx.channelDB.getAllChannels(), 'number');
    res.send(channels);
  } catch (err) {
    logger.error(err);
    res.status(500).send('error');
  }
});

channelsRouter.get('/api(/v1)?/channel/:number', async (req, res) => {
  try {
    let number = parseInt(req.params.number, 10);
    let channel = await req.ctx.channelCache.getChannelConfig(number);

    if (!isUndefined(channel)) {
      res.json(channel);
    } else {
      res.status(404).send('Channel not found');
    }
  } catch (err) {
    logger.error(err);
    res.status(500).send('error');
  }
});

channelsRouter.get(
  '/api(/v1)?/channel/programless/:number',
  async (req, res) => {
    try {
      let number = parseInt(req.params.number, 10);
      let channel = await req.ctx.channelCache.getChannelConfig(number);

      if (!isUndefined(channel)) {
        res.json(omit({ ...channel }, 'programs'));
      } else {
        res.status(404).send('Channel not found');
      }
    } catch (err) {
      logger.error(err);
      res.status(500).send('error');
    }
  },
);

channelsRouter.get('/api(/v1)?/channel/programs/:number', async (req, res) => {
  try {
    let number = parseInt(req.params.number, 10);
    let channel = await req.ctx.channelCache.getChannelConfig(number);

    if (!isUndefined(channel)) {
      let programs = channel.programs;
      if (isUndefined(programs)) {
        res.status(404).send("Channel doesn't have programs?");
      }
      res.writeHead(200, {
        'Content-Type': 'application/json',
      });

      let transformStream = JSONStream.stringify();
      transformStream.pipe(res);

      for (let i = 0; i < programs.length; i++) {
        transformStream.write(programs[i]);
        await throttle();
      }
      transformStream.end();
    } else {
      res.status(404).send('Channel not found');
    }
  } catch (err) {
    logger.error(err);
    res.status(500).send('error');
  }
});

channelsRouter.get(
  '/api(/v1)?/channel/description/:number',
  async (req, res) => {
    try {
      let number = parseInt(req.params.number, 10);
      let channel = await req.ctx.channelCache.getChannelConfig(number);
      if (!isUndefined(channel)) {
        res.send({
          number: channel.number,
          icon: channel.icon,
          name: channel.name,
          stealth: channel.stealth,
        });
      } else {
        res.status(404).send('Channel not found');
      }
    } catch (err) {
      logger.error(err);
      res.status(500).send('error');
    }
  },
);

channelsRouter.get('/api(/v1)?/channelNumbers', async (req, res) => {
  try {
    let channels = req.ctx.channelDB.getAllChannelNumbers();
    res.send(channels);
  } catch (err) {
    logger.error(err);
    res.status(500).send('error');
  }
});

channelsRouter.post('/api(/v1)?/channel', async (req, res) => {
  try {
    await req.ctx.m3uService.clearCache();
    cleanUpChannel(req.body);
    await req.ctx.channelDB.saveChannel(req.body as Channel);
    req.ctx.channelCache.clear();
    res.send({ number: req.body.number });
    updateXmltv();
  } catch (err) {
    logger.error(err);
    res.status(500).send('error');
  }
});

channelsRouter.put('/api(/v1)?/channel', async (req, res) => {
  try {
    await req.ctx.m3uService.clearCache();
    cleanUpChannel(req.body);
    await req.ctx.channelDB.saveChannel(req.body as Channel);
    req.ctx.channelCache.clear();
    res.send({ number: req.body.number });
    updateXmltv();
  } catch (err) {
    logger.error(err);
    res.status(500).send('error');
  }
});
channelsRouter.delete('/api(/v1)?/channel', async (req, res) => {
  try {
    await req.ctx.m3uService.clearCache();
    await req.ctx.channelDB.deleteChannel(req.body.number);
    req.ctx.channelCache.clear();
    res.send({ number: req.body.number });
    updateXmltv();
  } catch (err) {
    logger.error(err);
    res.status(500).send('error');
  }
});

function updateXmltv() {
  xmltvInterval.updateXML();
  xmltvInterval.restartInterval();
}

function cleanUpChannel(channel) {
  if (isUndefined(channel.groupTitle) || channel.groupTitle === '') {
    channel.groupTitle = 'dizqueTV';
  }
  channel.programs = channel.programs.flatMap(cleanUpProgram);
  delete channel.fillerContent;
  delete channel.filler;
  channel.fallback = channel.fallback.flatMap(cleanUpProgram);
  channel.duration = 0;
  for (let i = 0; i < channel.programs.length; i++) {
    channel.duration += channel.programs[i].duration;
  }
}

function cleanUpProgram(program) {
  delete program.start;
  delete program.stop;
  delete program.streams;
  delete program.durationStr;
  delete program.commercials;
  if (isUndefined(program.duration) || program.duration <= 0) {
    logger.error(
      `Input contained a program with invalid duration: ${program.duration}. This program has been deleted`,
    );
    return [];
  }
  if (!Number.isInteger(program.duration)) {
    logger.error(
      `Input contained a program with invalid duration: ${program.duration}. Duration got fixed to be integer.`,
    );
    program.duration = Math.ceil(program.duration);
  }
  return [program];
}
