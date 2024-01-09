import dayjs from 'dayjs';
import { isEphemeralProgram } from 'dizquetv-types';
import {
  ChannelLineupSchema,
  ChannelSchema,
  ProgramSchema,
  UpdateChannelRequestSchema,
  WorkingProgramSchema,
} from 'dizquetv-types/schemas';
import { filter, isError, isNil, omit, reduce, sortBy } from 'lodash-es';
import z from 'zod';
import { getEm } from '../../dao/dataSource.js';
import createLogger from '../../logger.js';
import { RouterPluginAsyncCallback } from '../../types/serverType.js';
import { attempt } from '../../util.js';
import { programMinter } from '../../util/programMinter.js';

const logger = createLogger(import.meta);

const ChannelNumberParamSchema = z.object({
  number: z.coerce.number(),
});

const ChannelLineupQuery = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  includePrograms: z.coerce.boolean().default(false),
});

// eslint-disable-next-line @typescript-eslint/require-await
export const channelsApiV2: RouterPluginAsyncCallback = async (fastify) => {
  fastify.addHook('onError', (req, _, error, done) => {
    logger.error(req.routeOptions.url, error);
    done();
  });

  fastify.get(
    '/channels',
    {
      schema: {
        operationId: 'getChannelsV2',
        response: {
          200: z.array(ChannelSchema),
          500: z.literal('error'),
        },
      },
    },
    async (req, res) => {
      try {
        const channels = sortBy(
          await req.serverCtx.channelDB.getAllChannels(),
          'number',
        );
        z.array(ChannelSchema).parse(channels.map((c) => c.toDTO()));
        return res.send(channels.map((c) => c.toDTO()));
      } catch (err) {
        console.error(err);
        return res.status(500).send('error');
      }
    },
  );

  fastify.get(
    '/channels/:number',
    {
      schema: {
        operationId: 'getChannelsByNumberV2',
        params: ChannelNumberParamSchema,
        response: {
          200: ChannelSchema,
          404: z.void(),
          500: z.void(),
        },
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
          return res.status(404).send();
        }
      } catch (err) {
        logger.error(req.routeConfig.url, err);
        return res.status(500).send();
      }
    },
  );

  fastify.post(
    '/channels',
    {
      schema: {
        operationId: 'createChannelV2',
        body: UpdateChannelRequestSchema,
        response: {
          201: z.object({ id: z.string() }),
          500: z.object({}),
        },
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
        body: UpdateChannelRequestSchema,
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
        response: {
          200: ChannelLineupSchema,
          404: z.object({ error: z.string() }),
        },
      },
    },
    async (req, res) => {
      const channel = await req.serverCtx.channelDB.getChannel(
        req.params.number,
      );

      if (!channel) {
        return res.status(404).send({ error: 'Channel Not Found' });
      }

      const startTime = req.query.from ?? new Date();
      const duration =
        channel.duration.asMilliseconds() <= 0
          ? dayjs.duration(1, 'hour')
          : channel.duration;
      const endTime = req.query.to ?? dayjs(startTime).add(duration).toDate();

      // Validate start and end time
      console.log(startTime, endTime, channel.durationMs);

      const lineup = await req.serverCtx.guideService.getChannelLineup(
        req.params.number,
        startTime,
        endTime,
      );

      return res.send(lineup);
    },
  );

  fastify.post(
    '/channels/:number/lineup',
    {
      schema: {
        params: ChannelNumberParamSchema,
        body: z.array(WorkingProgramSchema),
        response: {
          200: z.object({}),
        },
      },
    },
    async (req, res) => {
      const programsWithIndex = zipWithIndex(req.body);
      console.log(programsWithIndex);
      const nonPersisted = filter(req.body, isEphemeralProgram);
      const minter = programMinter(getEm());

      const programsToPersist = filter(
        nonPersisted,
        (p) => !isNil(p.externalSourceName),
      ).map((p) => minter(p.externalSourceName!, p.originalProgram));

      console.log(programsToPersist);
      return res.status(200).send();
    },
  );
};

function zipWithIndex<T>(
  arr: ReadonlyArray<T>,
): ReadonlyArray<T & { index: number }> {
  return reduce(
    arr,
    (prev, curr, i) => {
      return [...prev, { ...curr, index: i }];
    },
    [],
  );
}
