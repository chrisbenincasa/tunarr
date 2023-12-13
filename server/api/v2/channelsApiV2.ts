import { ChannelSchema, ProgramSchema } from 'dizquetv-types/schemas';
import { isNil, isUndefined, omit, sortBy } from 'lodash-es';
import z from 'zod';
import { Channel as ChannelEntity } from '../../dao/entities/Channel.js';
import createLogger from '../../logger.js';
import { RouterPluginAsyncCallback } from '../../types/serverType.js';

const logger = createLogger(import.meta);

const ChannelNumberParamSchema = z.object({
  number: z.coerce.number(),
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
        req.serverCtx.channelDB.getAllChannels(),
        'number',
      );
      return res.send(channels);
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
        const channel = req.serverCtx.channelCache.getChannelConfig(
          req.params.number,
        );

        if (!isUndefined(channel)) {
          return res.send(omit(channel, 'programs'));
        } else {
          return res.status(404);
        }
      } catch (err) {
        logger.error(req.routeConfig.url, err);
        return res.status(500);
      }
    },
  );

  fastify.put(
    '/channels/:number',
    {
      schema: {
        body: ChannelSchema.omit({ programs: true }).partial(),
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
            ChannelEntity.fromPartialDTO(channelUpdate),
          );
          return res.send(omit(channel, 'programs'));
        } else {
          return res.status(404);
        }
      } catch (err) {
        logger.error(req.routeConfig.url, err);
        return res.status(500);
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
        },
      },
    },
    async (req, res) => {
      try {
        const channel = await req.serverCtx.channelCache.getChannelConfig(
          req.params.number,
        );

        if (!isNil(channel)) {
          // z.array(ProgramSchema).readonly().parse(channel.programs);
          await channel.programs.init();
          return res.send(channel.programs.map((p) => p.toDTO()));
          // const readableStream = new Readable();
          // readableStream._read = () => {};

          // void res
          //   .header('content-type', 'application/json')
          //   .send(readableStream);

          // // This is preserving previous behavior that it's unclear is even
          // // necessary
          // setTimeout(() => {
          //   readableStream.push('[');
          //   channel.programs.forEach((program, idx) => {
          //     readableStream.push(JSON.stringify(program)); // Look into other stringify methods
          //     if (idx < channel.programs.length - 1) {
          //       readableStream.push(',');
          //     }
          //   });
          //   readableStream.push(']');
          //   readableStream.push(null);
          // });

          // return res;
        } else {
          return res.status(404);
        }
      } catch (err) {
        logger.error(req.routeOptions.url, err);
        return res.status(500);
      }
    },
  );
};
