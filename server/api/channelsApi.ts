import JSONStream from 'JSONStream';
import { FastifyPluginCallback, RequestGenericInterface } from 'fastify';
import { isUndefined, omit, sortBy } from 'lodash-es';
import { Writable } from 'stream';
import { Channel, Program } from '../dao/db.js';
import createLogger from '../logger.js';
import { scheduledJobsById } from '../services/scheduler.js';
import throttle from '../services/throttle.js';

const logger = createLogger(import.meta);

interface ChannelNumberParams extends RequestGenericInterface {
  Params: { number: number };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const channelsRouter: FastifyPluginCallback = (fastify, _opts, done) => {
  fastify.get('/api/channels', async (req, res) => {
    try {
      const channels = sortBy(
        req.serverCtx.channelDB.getAllChannels(),
        'number',
      );
      return res.send(channels);
    } catch (err) {
      logger.error(err);
      return res.status(500).send('error');
    }
  });

  fastify.get<ChannelNumberParams>('/api/channel/:number', async (req, res) => {
    try {
      const channel = req.serverCtx.channelCache.getChannelConfig(
        req.params.number,
      );

      if (!isUndefined(channel)) {
        return res.send(channel);
      } else {
        return res.status(404).send('Channel not found');
      }
    } catch (err) {
      logger.error(err);
      return res.status(500).send('error');
    }
  });

  fastify.get<ChannelNumberParams>(
    '/api/channel/programless/:number',
    async (req, res) => {
      try {
        const channel = req.serverCtx.channelCache.getChannelConfig(
          req.params.number,
        );

        if (!isUndefined(channel)) {
          return res.send(omit({ ...channel }, 'programs'));
        } else {
          return res.status(404).send('Channel not found');
        }
      } catch (err) {
        logger.error(err);
        return res.status(500).send('error');
      }
    },
  );

  fastify.get<ChannelNumberParams>(
    '/api/channel/programs/:number',
    async (req, res) => {
      try {
        const channel = req.serverCtx.channelCache.getChannelConfig(
          req.params.number,
        );

        if (!isUndefined(channel)) {
          const programs = channel.programs;
          if (isUndefined(programs)) {
            return res.status(404).send("Channel doesn't have programs?");
          }

          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
          const transformStream: Writable = JSONStream.stringify();
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
          transformStream.pipe(res.raw);

          for (let i = 0; i < programs.length; i++) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            transformStream.write(programs[i]);
            await throttle();
          }
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
          transformStream.end();

          return res.header('Content-Type', 'application/json');
        } else {
          return res.status(404).send('Channel not found');
        }
      } catch (err) {
        logger.error(req.routeOptions.url, err);
        return res.status(500).send('error');
      }
    },
  );

  fastify.get<ChannelNumberParams>(
    '/api/channel/description/:number',
    async (req, res) => {
      try {
        const channel = req.serverCtx.channelCache.getChannelConfig(
          req.params.number,
        );
        if (!isUndefined(channel)) {
          return res.send({
            number: channel.number,
            icon: channel.icon,
            name: channel.name,
            stealth: channel.stealth,
          });
        } else {
          return res.status(404).send('Channel not found');
        }
      } catch (err) {
        logger.error(err);
        return res.status(500).send('error');
      }
    },
  );

  fastify.get('/api/channelNumbers', async (req, res) => {
    try {
      const channels = req.serverCtx.channelDB.getAllChannelNumbers();
      return res.send(channels);
    } catch (err) {
      logger.error(err);
      return res.status(500).send('error');
    }
  });

  fastify.post<{ Body: Channel }>('/api/channel', async (req, res) => {
    try {
      await req.serverCtx.m3uService.clearCache();
      cleanUpChannel(req.body);
      await req.serverCtx.channelDB.saveChannel(req.body);
      req.serverCtx.channelCache.clear();
      await res.send({ number: req.body.number });
      await updateXmltv();
    } catch (err) {
      logger.error(err);
      return res.status(500).send('error');
    }
  });

  fastify.put<{ Body: Channel }>('/api/channel', async (req, res) => {
    try {
      await req.serverCtx.m3uService.clearCache();
      cleanUpChannel(req.body);
      await req.serverCtx.channelDB.saveChannel(req.body);
      req.serverCtx.channelCache.clear();
      await res.send({ number: req.body.number });
      await updateXmltv();
    } catch (err) {
      logger.error(err);
      await res.status(500).send('error');
    }
  });

  fastify.delete<{ Body: { number: number } }>(
    '/api/channel',
    async (req, res) => {
      try {
        await req.serverCtx.m3uService.clearCache();
        await req.serverCtx.channelDB.deleteChannel(req.body.number);
        req.serverCtx.channelCache.clear();
        await res.send({ number: req.body.number });
        await updateXmltv();
      } catch (err) {
        logger.error(err);
        return res.status(500).send('error');
      }
    },
  );

  done();
};

async function updateXmltv() {
  await scheduledJobsById['update-xmltv']?.runNow();
}

function cleanUpChannel(channel: Channel) {
  if (isUndefined(channel.groupTitle) || channel.groupTitle === '') {
    channel.groupTitle = 'dizqueTV';
  }
  channel.programs = channel.programs.flatMap(cleanUpProgram);
  // delete channel.fillerContent;
  // delete channel.filler;
  channel.fallback = channel.fallback.flatMap(cleanUpProgram);
  channel.duration = 0;
  for (let i = 0; i < channel.programs.length; i++) {
    channel.duration += channel.programs[i].duration;
  }
}

function cleanUpProgram(program: Program) {
  // delete program.start;
  // delete program.stop;
  // delete program.streams;
  // delete program.durationStr;
  // delete program.commercials;
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
