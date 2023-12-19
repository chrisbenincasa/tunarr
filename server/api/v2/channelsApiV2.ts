import { CreateChannelSchema, ProgramSchema } from 'dizquetv-types/schemas';
import { isError, isNil, omit, sortBy } from 'lodash-es';
import z from 'zod';
import createLogger from '../../logger.js';
import { RouterPluginAsyncCallback } from '../../types/serverType.js';
import { attempt } from '../../util.js';

const logger = createLogger(import.meta);

const ChannelNumberParamSchema = z.object({
  number: z.coerce.number(),
});

const ChannelLineupQuery = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
});

// eslint-disable-next-line @typescript-eslint/require-await
export const channelsApiV2: RouterPluginAsyncCallback = async (fastify) => {
  fastify.addHook('onError', (req, _, error, done) => {
    logger.error(req.routeConfig.url, error);
    done();
  });

  fastify.get('/channels', async (req, res) => {
    try {
      const channels = sortBy(
        await req.serverCtx.channelDB.getAllChannels(),
        'number',
      );
      return res.send(channels.map((c) => c.toDTO()));
    } catch (err) {
      logger.error(req.routeConfig.url, err);
      return res.status(500).send('error');
    }
  });

  fastify.get(
    '/channels/:number',
    {
      schema: {
        params: ChannelNumberParamSchema,
      },
    },
    async (req, res) => {
      try {
        const channel = await req.serverCtx.channelCache.getChannelConfig(
          req.params.number,
        );

        if (!isNil(channel)) {
          return res.send(channel.toDTO());
        } else {
          return res.status(404);
        }
      } catch (err) {
        logger.error(req.routeConfig.url, err);
        return res.status(500);
      }
    },
  );

  fastify.post(
    '/channels',
    {
      schema: {
        body: CreateChannelSchema,
      },
    },
    async (req, res) => {
      const inserted = await attempt(() =>
        req.serverCtx.channelDB.saveChannel(req.body),
      );
      if (isError(inserted)) {
        return res.status(500).send(inserted);
      }
      return res.status(201).send({ id: inserted });
    },
  );

  fastify.put(
    '/channels/:number',
    {
      schema: {
        body: CreateChannelSchema,
        params: ChannelNumberParamSchema,
      },
    },
    async (req, res) => {
      try {
        const channel = await req.serverCtx.channelCache.getChannelConfig(
          req.params.number,
        );

        if (!isNil(channel)) {
          const channelUpdate = {
            ...req.body,
          };
          await req.serverCtx.channelDB.updateChannel(
            channel.uuid,
            channelUpdate,
          );
          return res.send(omit(channel, 'programs'));
        } else {
          return res.status(404).send();
        }
      } catch (err) {
        logger.error(req.routeConfig.url, err);
        return res.status(500).send();
      }
    },
  );

  fastify.get(
    '/channels/:number/programs',
    {
      schema: {
        params: ChannelNumberParamSchema,
        response: {
          200: z.array(ProgramSchema).readonly(),
          404: z.void(),
        },
      },
    },
    async (req, res) => {
      try {
        const channel = await req.serverCtx.channelCache.getChannelConfig(
          req.params.number,
        );

        console.log(channel);

        if (!isNil(channel)) {
          await channel.programs.init();
          const programDtos = channel.programs.map((p) => p.toDTO());
          return res.send(programDtos);
        } else {
          return res.status(404).send();
        }
      } catch (err) {
        logger.error(req.routeOptions.url, err);
        return res.status(500).send();
      }
    },
  );

  fastify.get(
    '/channels/:number/lineup',
    {
      schema: {
        params: ChannelNumberParamSchema,
        querystring: ChannelLineupQuery,
      },
    },
    async (req, res) => {
      const lineup = await req.serverCtx.guideService.getChannelLineup(
        req.params.number,
        req.query.from,
        req.query.to,
      );

      return res.send(lineup);
    },
  );
};
